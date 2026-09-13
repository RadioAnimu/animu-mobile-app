import type {
  AuthLinkResult,
  AuthProfile,
  AuthSession,
  AuthSetCredentialsParams,
  AuthUnlinkResult,
  ProviderInfo,
} from "animu-api";
import {
  AUTH_REDIRECT_URI,
  DEFAULT_PROVIDERS,
  getProviderConfig,
  redirectUriForProvider,
} from "../../constants/auth";
import type { User } from "../domain/user";
import { AsyncStorageSessionStore } from "./adapters/async-storage.adapter";
import { AnimuAuthAdapter } from "./adapters/animu-auth.adapter";
import { OAuthAdapter } from "./adapters/oauth.adapter";
import { AuthFlowCancelled } from "./errors";
import type { AuthApiPort, OAuthPort, SessionStorePort } from "./ports";

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

  /** Provider login: server-side redirect for Google, authorize→exchange otherwise. */
  async loginWithProvider(provider: string): Promise<User> {
    if (getProviderConfig(provider)?.mode === "server") {
      return this.loginWithMobileGoogle();
    }
    const oauth = await this.oauth.authorize(provider);
    const session = await this.api.exchangeToken({
      provider,
      code: oauth.code,
      redirectUri: oauth.omitRedirectUri
        ? undefined
        : redirectUriForProvider(provider),
      codeVerifier: oauth.codeVerifier,
    });
    return this.adopt(session);
  }

  /**
   * Server-side Google login: open the backend's start URL in a browser
   * session and adopt the session token from the deep link it bounces back.
   * The backend owns the Google OAuth client, PKCE and redirect, so no native
   * SDK, client id or signing-certificate registration is involved.
   */
  private async loginWithMobileGoogle(): Promise<User> {
    const callbackUrl = await this.oauth.openSession(
      this.api.googleMobileStartUrl(),
      AUTH_REDIRECT_URI,
    );
    if (!callbackUrl) throw new AuthFlowCancelled();

    const result = this.api.completeMobileGoogleLogin(callbackUrl);
    if (!result.ok) {
      throw new Error(
        result.message ? `${result.error}: ${result.message}` : result.error,
      );
    }

    // completeMobileGoogleLogin already stored the token on the client; set it
    // explicitly too so the port doesn't depend on that side effect.
    this.api.setSessionToken(result.token);
    const profile = await this.api.getProfile();
    return this.adopt({
      sessionToken: result.token,
      action: result.action,
      user: profile.user,
    });
  }

  /** Animu Connect login (native username/password). */
  async loginWithAnimuConnect(
    username: string,
    password: string,
  ): Promise<User> {
    const session = await this.api.nativeLogin({ username, password });
    return this.adopt(session);
  }

  // ─── Account management ───────────────────────────────────────────────

  /**
   * Links an extra provider. Server-mode providers (Google) run the backend's
   * browser flow with the current session token; the rest use the client-side
   * OAuth redirect + code exchange.
   */
  async linkProvider(provider: string): Promise<AuthLinkResult | void> {
    const config = getProviderConfig(provider);
    if (!config || config.linkable === false) {
      throw new Error(`Provider "${provider}" cannot be linked from the app`);
    }
    if (config.mode === "server") {
      return this.linkWithMobileGoogle();
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
   * Server-side Google link: open the start URL with the current session
   * token (`?sid=`) and adopt the bounce. The token is unchanged; the caller
   * refreshes the profile so the new link shows up.
   */
  private async linkWithMobileGoogle(): Promise<void> {
    const sessionToken = this.api.getSessionToken();
    if (!sessionToken) throw new Error("Not authenticated");

    const callbackUrl = await this.oauth.openSession(
      this.api.googleMobileStartUrl(sessionToken),
      AUTH_REDIRECT_URI,
    );
    if (!callbackUrl) throw new AuthFlowCancelled();

    const result = this.api.completeMobileGoogleLogin(callbackUrl);
    if (!result.ok) {
      throw new Error(
        result.message ? `${result.error}: ${result.message}` : result.error,
      );
    }
  }

  unlinkProvider(provider: string): Promise<AuthUnlinkResult> {
    return this.api.unlinkProvider(provider);
  }

  setCredentials(params: AuthSetCredentialsParams) {
    return this.api.setCredentials(params);
  }

  uploadAvatar(avatar: Blob, filename?: string): Promise<string | null> {
    return this.api.uploadAvatar({ avatar, filename });
  }

  resetAvatar(): Promise<string | null> {
    return this.api.resetAvatar();
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

/** Production wiring: package client + expo-auth-session + AsyncStorage. */
export const authFacade = new AuthFacade(
  new AnimuAuthAdapter(),
  new OAuthAdapter(),
  new AsyncStorageSessionStore(),
);
