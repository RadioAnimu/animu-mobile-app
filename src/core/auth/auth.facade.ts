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
  redirectUriForProvider,
} from "@/constants/auth";
import type { User } from "@/core/domain/user";
import { SecureSessionStore } from "@/core/auth/adapters/secure-session.adapter";
import { AnimuAuthAdapter } from "@/core/auth/adapters/animu-auth.adapter";
import { OAuthAdapter } from "@/core/auth/adapters/oauth.adapter";
import {
  AuthFlowCancelled,
  ProviderEmailTaken,
  ProviderLinkConflict,
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
 * The server's refusal of a first sign-in whose provider email already belongs
 * to another account. It only travels as free text (the `msg` of an
 * `error=oauth` bounce, or the message of a `token_exchange_failed` response),
 * so it is matched leniently: case, padding and a trailing period don't count.
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
 * Single entry point to authentication, composing three ports:
 *
 * - {@link AuthApiPort} — the Animu Auth v5 API (token, profile, account);
 * - {@link OAuthPort} — provider redirects (Discord/Google/Apple);
 * - {@link SessionStorePort} — persistence of the session token + user.
 *
 * Views never touch the ports directly; they call this facade (through the
 * `useAuth` context), which owns the OAuth→session exchange and the
 * persistence rules. Provider-specific quirks stay in the adapters.
 */
export class AuthFacade {
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
    // Always surface the known providers — even ones the server has not
    // enabled yet — so the login screen can advertise them as "coming soon".
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
   * Re-pulls provider data, persists the refreshed user and returns the
   * updated user + profile in one round-trip.
   */
  async refreshProfile(
    current: User,
  ): Promise<{ user: User; profile: AuthProfile }> {
    const result = await this.api.refreshProfile();
    const user: User = {
      ...result.user,
      sessionToken: current.sessionToken,
      nickname: result.user.handle ?? "",
    };
    await this.store.save({ sessionToken: user.sessionToken, user });
    const profile = await this.api.getProfile();
    return { user, profile };
  }

  // ─── Login ────────────────────────────────────────────────────────────

  /**
   * Provider login. Apple tries the native iOS sheet first (falling back to
   * the server flow on Android); server-mode providers (Discord/Google/Apple)
   * delegate the redirect to the backend; anything else runs the app-driven
   * OAuth redirect.
   */
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
      // No native Apple here (e.g. Android) — fall through to the server flow.
    }
    if (config.mode === "server") {
      return this.loginWithMobileProvider(provider);
    }

    const oauth = await this.oauth.authorize(provider);
    const session = await this.exchangeOrEmailTaken(provider, () =>
      this.api.exchangeToken({
        provider,
        code: oauth.code,
        redirectUri: oauth.omitRedirectUri
          ? undefined
          : redirectUriForProvider(provider),
        codeVerifier: oauth.codeVerifier,
      }),
    );
    return this.adopt(session);
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
   * Server-side login: open the backend's `/mobile/<provider>-start.php` in a
   * browser session and adopt the session token from the deep-link bounce. The
   * backend owns the provider's OAuth client, PKCE and redirect, so no client
   * id, SDK or signing-certificate registration is involved.
   */
  private async loginWithMobileProvider(provider: string): Promise<User> {
    const callbackUrl = await this.runBrowserFlow(
      this.api.mobileStartUrl(provider),
    );
    if (!callbackUrl) throw new AuthFlowCancelled();
    return this.adoptMobileCallback(callbackUrl, provider);
  }

  /**
   * Cold-start recovery for the server-provider browser flow. If the OS killed
   * the app while the auth browser was open, the `animuapp://redirect` bounce
   * is delivered as the app's launch URL instead of resolving the in-flight
   * `openSession` promise — without this the user lands on the login screen
   * with no way to adopt the already-issued token.
   *
   * A bounce is only adoptable when a FRESH pending-flow marker exists (see
   * {@link runBrowserFlow}): the URL itself is unauthenticated input, and
   * adopting any token found in it would let a spoofed notification/link
   * overwrite the user's session with the attacker's.
   */
  async resumeServerAuth(url: string | null | undefined): Promise<User | null> {
    if (!isMobileAuthCallback(url)) return null;
    if (!(await this.store.takeServerAuthPending())) return null;
    return this.adoptMobileCallback(url);
  }

  /**
   * Opens the auth browser with a pending-flow marker ARMED FIRST: the marker
   * stamps that the user launched this flow and persists across process
   * death, so `resumeServerAuth` can adopt the OS-delivered cold-start bounce
   * — while every other `animuapp://redirect` source stays unadoptable.
   */
  private async runBrowserFlow(startUrl: string): Promise<string | null> {
    await this.store.markServerAuthPending();
    try {
      return await this.oauth.openSession(startUrl, AUTH_REDIRECT_URI);
    } finally {
      // Resolved in-app (login, dismissal or thrown): the flow ended, so the
      // marker must not authorize a LATER cold-start adoption. The app being
      // killed mid-flow runs nothing — the marker legitimately persists for
      // `resumeServerAuth`, until its adapter TTL.
      await this.store.discardServerAuthPending();
    }
  }

  /**
   * `provider` is unknown on the cold-start path: the bounce URL doesn't carry
   * it, and the marker only proves a flow was started.
   */
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

    // completeMobileAuth already stored the token on the client; set it
    // explicitly too so the port doesn't depend on that side effect.
    this.api.setSessionToken(result.token);
    let profile: AuthProfile;
    try {
      profile = await this.api.getProfile();
    } catch (error) {
      // Nothing was adopted: the app still holds the previous user, so the
      // client must not keep talking with the new account's token.
      this.api.setSessionToken(previousToken);
      throw error;
    }
    return this.adopt({
      sessionToken: result.token,
      action: result.action,
      user: profile.user,
    });
  }

  /**
   * Native Apple login: hand the SDK's RS256 identity token to the server,
   * which verifies it against Apple's JWKS (no redirect, PKCE or client id).
   */
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

  /**
   * Links an extra provider. Apple tries the native iOS sheet first; server
   * providers (Discord/Google/Apple) run the backend browser flow with the
   * current session token; the rest use the app-driven OAuth redirect.
   */
  async linkProvider(provider: string): Promise<AuthLinkResult | void> {
    try {
      return await this.runLink(provider);
    } catch (error) {
      // The JSON endpoint answers `link_conflict` as an API error; the browser
      // flow's `?error=link_conflict` bounce is mapped in linkWithMobileProvider.
      if (error instanceof AnimuApiError && error.code === "link_conflict") {
        throw new ProviderLinkConflict(provider);
      }
      throw error;
    }
  }

  private async runLink(provider: string): Promise<AuthLinkResult | void> {
    const config = getProviderConfig(provider);
    if (!config || config.linkable === false) {
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
    if (config.mode === "server") {
      return this.linkWithMobileProvider(provider);
    }

    const oauth = await this.oauth.authorize(provider);
    return this.api.linkProvider({
      provider,
      code: oauth.code,
      redirectUri: oauth.omitRedirectUri
        ? undefined
        : redirectUriForProvider(provider),
      codeVerifier: oauth.codeVerifier,
      user: oauth.user,
    });
  }

  /**
   * Server-side link: open the start URL with the current session token
   * (`?sid=`) and adopt the bounce. The token is unchanged; the caller
   * refreshes the profile so the new link shows up.
   */
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
    } finally {
      await this.forget();
    }
  }

  /** Forgets the session locally without calling the server. */
  async forget(): Promise<void> {
    this.api.setSessionToken(null);
    await this.store.clear();
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async adopt(session: AuthSession): Promise<User> {
    const user = this.toUser(session);
    await this.store.save({ sessionToken: user.sessionToken, user });
    return user;
  }

  private toUser(session: AuthSession): User {
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
