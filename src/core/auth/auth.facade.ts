import {
  AnimuApiError,
  type AuthEmailCodeParams,
  type AuthEmailRequestResult,
  type AuthEmailsResult,
  type AuthLinkResult,
  type AuthProfile,
  type AuthRemoveEmailResult,
  type AuthSession,
  type AuthUnlinkResult,
  type ProviderInfo,
} from "animu-api";
import {
  AUTH_REDIRECT_URI,
  DEFAULT_PROVIDERS,
  getProviderConfig,
} from "@/constants/auth";
import type { User } from "@/core/domain/user";
import { SecureSessionStore } from "@/core/auth/adapters/secure-session.adapter";
import { AnimuAuthAdapter } from "@/core/auth/adapters/animu-auth.adapter";
import { OAuthAdapter } from "@/core/auth/adapters/oauth.adapter";
import {
  AuthFlowCancelled,
  ProviderEmailTaken,
  ProviderLinkConflict,
  isRetryableRequestFailure,
} from "@/core/auth/errors";
import type {
  AppleNativeCredential,
  AuthApiPort,
  OAuthPort,
  SessionStorePort,
} from "@/core/auth/ports";

/** Where the auth server bounces a finished browser flow. */
const MOBILE_AUTH_CALLBACK = "animuapp://redirect";

/**
 * Whether `url` is exactly the auth callback, with any query. A prefix test
 * would also accept `animuapp://redirect.evil?token=…`. RN's URL polyfill only
 * parses HTTP authorities, so the part before the query is compared verbatim.
 */
function isMobileAuthCallback(url: string | null | undefined): url is string {
  if (!url || url.includes("#")) return false;
  const queryIndex = url.indexOf("?");
  const destination = queryIndex < 0 ? url : url.slice(0, queryIndex);
  return (
    destination === MOBILE_AUTH_CALLBACK ||
    destination === `${MOBILE_AUTH_CALLBACK}/`
  );
}

const INVALID_CALLBACK = "Invalid authentication callback URL";

/**
 * The server's "email already taken" refusal of a first sign-in. It only
 * travels as free text, so case, padding and a trailing period don't count.
 */
function isEmailTakenMessage(message: string | null | undefined): boolean {
  return (
    message?.trim().replace(/\.$/, "").toLowerCase() === "email already taken"
  );
}

/** Whether `error` is the native-exchange form of the email-taken refusal. */
function isEmailTakenExchangeError(error: unknown): boolean {
  return (
    error instanceof AnimuApiError &&
    error.code === "token_exchange_failed" &&
    isEmailTakenMessage(error.message)
  );
}

/**
 * Single entry point to authentication over three ports: the Animu Auth API
 * ({@link AuthApiPort}), provider sign-in ({@link OAuthPort}) and session
 * persistence ({@link SessionStorePort}). Provider quirks stay in the adapters.
 */
export class AuthFacade {
  /** Session saves and clears run one at a time (see {@link queueStore}). */
  private storeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly api: AuthApiPort,
    private readonly oauth: OAuthPort,
    private readonly store: SessionStorePort,
  ) {}

  // ─── Session ──────────────────────────────────────────────────────────

  /** Rehydrates the persisted session and adopts its token. */
  async restore(): Promise<User | null> {
    const stored = await this.store.load();
    if (!stored?.sessionToken) return null;
    this.api.setSessionToken(stored.sessionToken);
    return stored.user;
  }

  async getProviders(): Promise<ProviderInfo[]> {
    let server: ProviderInfo[] = [];
    try {
      server = await this.api.getProviders();
    } catch (error) {
      console.error("[AuthFacade] Failed to fetch providers:", error);
    }
    // Known providers the server has not enabled yet show as "coming soon".
    const known = new Set(server.map((provider) => provider.name));
    const extra = DEFAULT_PROVIDERS.filter(
      (provider) => !known.has(provider.name),
    );
    const merged = [...server, ...extra];
    return merged.length > 0 ? merged : DEFAULT_PROVIDERS;
  }

  async getSessionStatus(): Promise<boolean> {
    return (await this.api.getSessionStatus()).authenticated;
  }

  async getProfile(): Promise<AuthProfile> {
    return this.api.getProfile();
  }

  /**
   * Re-pulls provider data and persists the refreshed user; `null` when the
   * session changed meanwhile (saving then would revive a signed-out one).
   */
  async refreshProfile(
    current: User,
  ): Promise<{ user: User; profile: AuthProfile } | null> {
    const result = await this.api.refreshProfile();
    if (this.api.getSessionToken() !== current.sessionToken) return null;
    const user = this.toUser({ sessionToken: current.sessionToken, user: result.user });
    await this.queueStore(() => this.store.save({ sessionToken: user.sessionToken, user }));
    const profile = await this.api.getProfile();
    return { user, profile };
  }

  // ─── Login ────────────────────────────────────────────────────────────

  /** Provider login: Apple's native iOS sheet first, else the backend's browser flow. */
  async loginWithProvider(provider: string): Promise<User> {
    const config = getProviderConfig(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);

    if (config.native === "apple") {
      const credential = await this.oauth.authorizeAppleNative();
      if (credential) {
        return this.adopt(
          await this.exchangeOrEmailTaken(provider, () =>
            this.exchangeAppleIdentity(credential),
          ),
        );
      }
      // No native Apple here (e.g. Android): the server flow.
    }
    return this.loginWithMobileProvider(provider);
  }

  /** Runs a sign-in token exchange, naming the email-taken refusal. */
  private async exchangeOrEmailTaken(
    provider: string,
    exchange: () => Promise<AuthSession>,
  ): Promise<AuthSession> {
    try {
      return await exchange();
    } catch (error) {
      if (isEmailTakenExchangeError(error)) {
        throw new ProviderEmailTaken(provider);
      }
      throw error;
    }
  }

  /**
   * Server-side login: the backend's start page in a browser session, then the
   * token from the deep-link bounce. The backend owns OAuth, PKCE and redirect.
   */
  private async loginWithMobileProvider(provider: string): Promise<User> {
    const callbackUrl = await this.runBrowserFlow(
      this.api.mobileStartUrl(provider),
    );
    if (!callbackUrl) throw new AuthFlowCancelled();
    return this.adoptMobileCallback(callbackUrl, provider);
  }

  /**
   * Cold-start recovery: when the OS killed the app during the browser flow,
   * the bounce arrives as the launch URL. It is adopted only with a fresh
   * pending-flow marker ({@link runBrowserFlow}): the URL is untrusted input,
   * and a spoofed link must not replace the session with an attacker's.
   */
  async resumeServerAuth(url: string | null | undefined): Promise<User | null> {
    if (!isMobileAuthCallback(url)) return null;
    if (!(await this.store.takeServerAuthPending())) return null;
    return this.adoptMobileCallback(url);
  }

  /**
   * Opens the auth browser after arming a pending-flow marker, which survives
   * process death so only this flow's bounce can be adopted at cold start.
   */
  private async runBrowserFlow(startUrl: string): Promise<string | null> {
    await this.store.markServerAuthPending();
    try {
      return await this.oauth.openSession(startUrl, AUTH_REDIRECT_URI);
    } finally {
      // Ended in-app, so the marker must not authorize a later adoption. A
      // killed app runs nothing here: the marker lives on until its TTL.
      await this.store.discardServerAuthPending();
    }
  }

  /** `provider` is unknown at cold start: the bounce doesn't carry it. */
  private async adoptMobileCallback(
    callbackUrl: string,
    provider?: string,
  ): Promise<User> {
    if (!isMobileAuthCallback(callbackUrl)) throw new Error(INVALID_CALLBACK);
    // completeMobileAuth stores the bounce's token on the client before we
    // know the login took; keep the old one to put back if it doesn't.
    const previousToken = this.api.getSessionToken();
    const result = this.api.completeMobileAuth(callbackUrl);
    if (!result.ok) {
      if (result.error === "oauth" && isEmailTakenMessage(result.message)) {
        throw new ProviderEmailTaken(provider);
      }
      throw new Error(
        result.message ? `${result.error}: ${result.message}` : result.error,
      );
    }

    // Explicit too, so the port doesn't depend on that side effect.
    this.api.setSessionToken(result.token);
    let profile: AuthProfile;
    try {
      profile = await this.api.getProfile();
    } catch (error) {
      // Nothing adopted: back to the previous user's token.
      this.api.setSessionToken(previousToken);
      throw error;
    }
    return this.adopt({
      sessionToken: result.token,
      action: result.action,
      user: profile.user,
    });
  }

  /** Native Apple login: the server verifies the SDK's identity token against Apple's keys. */
  private async exchangeAppleIdentity(
    credential: AppleNativeCredential,
  ): Promise<AuthSession> {
    return this.api.exchangeToken({
      provider: "apple",
      identityToken: credential.identityToken,
      name: credential.name,
      firstName: credential.firstName,
      lastName: credential.lastName,
    });
  }

  /** Animu Connect login, step 1: request the 4-digit email code. */
  requestEmailLoginCode(email: string): Promise<AuthEmailRequestResult> {
    return this.api.requestEmailLoginCode(email);
  }

  /** Animu Connect login, step 2: verify the emailed code and adopt the session. */
  async loginWithEmailCode(email: string, code: string): Promise<User> {
    const session = await this.api.verifyEmailLoginCode({ email, code });
    return this.adopt(session);
  }

  // ─── Account management ───────────────────────────────────────────────

  /** Links an extra provider: Apple's native iOS sheet first, else the backend's browser flow. */
  async linkProvider(provider: string): Promise<AuthLinkResult | void> {
    try {
      return await this.runLink(provider);
    } catch (error) {
      // The JSON endpoint's form; the browser bounce's is mapped in linkWithMobileProvider.
      if (error instanceof AnimuApiError && error.code === "link_conflict") {
        throw new ProviderLinkConflict(provider);
      }
      throw error;
    }
  }

  private async runLink(provider: string): Promise<AuthLinkResult | void> {
    const config = getProviderConfig(provider);
    if (!config) {
      throw new Error(`Provider "${provider}" cannot be linked from the app`);
    }

    if (config.native === "apple") {
      const credential = await this.oauth.authorizeAppleNative();
      if (credential) {
        return this.api.linkProvider({
          provider,
          identityToken: credential.identityToken,
          name: credential.name,
          firstName: credential.firstName,
          lastName: credential.lastName,
        });
      }
    }
    return this.linkWithMobileProvider(provider);
  }

  /** Server-side link with the current session (`?sid=`); the caller refreshes the profile. */
  private async linkWithMobileProvider(provider: string): Promise<void> {
    const sessionToken = this.api.getSessionToken();
    if (!sessionToken) throw new Error("Not authenticated");

    const callbackUrl = await this.runBrowserFlow(
      this.api.mobileStartUrl(provider, sessionToken),
    );
    if (!callbackUrl) throw new AuthFlowCancelled();

    if (!isMobileAuthCallback(callbackUrl)) throw new Error(INVALID_CALLBACK);
    const result = this.api.completeMobileAuth(callbackUrl);
    if (!result.ok) {
      if (result.error === "link_conflict") {
        throw new ProviderLinkConflict(provider);
      }
      throw new Error(
        result.message ? `${result.error}: ${result.message}` : result.error,
      );
    }
  }

  unlinkProvider(provider: string): Promise<AuthUnlinkResult> {
    return this.api.unlinkProvider(provider);
  }

  // ─── Animu Connect emails ─────────────────────────────────────────────

  /** Lists the account's Animu Connect emails (provider + extra). */
  getEmails(): Promise<AuthEmailsResult> {
    return this.api.getEmails();
  }

  /** Requests a code to add/replace the extra Animu Connect email. */
  requestAddEmail(email: string): Promise<AuthEmailRequestResult> {
    return this.api.requestAddEmail(email);
  }

  /** Verifies the code and stores the extra Animu Connect email. */
  verifyAddEmail(params: AuthEmailCodeParams): Promise<AuthEmailsResult> {
    return this.api.verifyAddEmail(params);
  }

  /** Removes the extra (`source: "animu"`) email by id. */
  removeEmail(emailId: number): Promise<AuthRemoveEmailResult> {
    return this.api.removeEmail(emailId);
  }

  // ─── Teardown ─────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      await this.forget();
    }
  }

  async deleteAccount(): Promise<void> {
    try {
      await this.api.deleteAccount();
    } catch (error) {
      // Offline, timeout or 5xx: the account is still there, keep the session
      // to retry. Any other failure leaves no usable session (the client drops
      // its own after any 2xx), so the local copy goes too.
      if (isRetryableRequestFailure(error)) throw error;
      await this.forget();
      throw error;
    }
    await this.forget();
  }

  /** Forgets the session locally without calling the server. */
  async forget(): Promise<void> {
    this.api.setSessionToken(null);
    await this.queueStore(() => this.store.clear());
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async adopt(session: AuthSession): Promise<User> {
    const user = this.toUser(session);
    await this.queueStore(() => this.store.save({ sessionToken: user.sessionToken, user }));
    return user;
  }

  /**
   * Queues a session write behind the ones already running: a save that
   * started before a sign-out lands before its clear, never after it.
   */
  private queueStore(write: () => Promise<void>): Promise<void> {
    const run = this.storeQueue.then(write);
    this.storeQueue = run.catch(() => {});
    return run;
  }

  private toUser(session: Pick<AuthSession, "sessionToken" | "user">): User {
    return {
      ...session.user,
      sessionToken: session.sessionToken,
      nickname: session.user.handle ?? "",
    };
  }
}

/** Production wiring: package client + expo-auth-session + secure keychain storage. */
export const authFacade = new AuthFacade(
  new AnimuAuthAdapter(),
  new OAuthAdapter(),
  new SecureSessionStore(),
);
