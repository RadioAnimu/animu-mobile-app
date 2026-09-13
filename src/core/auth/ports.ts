import type {
  AuthCredentialsResult,
  AuthExchangeParams,
  AuthLinkParams,
  AuthLinkResult,
  AuthNativeLoginParams,
  AuthProfile,
  AuthRefreshResult,
  AuthSession,
  AuthSessionStatus,
  AuthSetCredentialsParams,
  AuthUnlinkResult,
  MobileAuthRedirect,
  ProviderInfo,
} from "animu-api";
import type { User } from "../domain/user";

/** Normalized OAuth hand-off: the code plus any provider-specific extras. */
export interface OAuthResult {
  code: string;
  codeVerifier?: string;
  /** Apple only: the consent `user` JSON (link flow). */
  user?: string;
  /**
   * Native flows (Google serverAuthCode, Apple) omit `redirectUri` from the
   * exchange entirely — the server redeems the code with its own client.
   */
  omitRedirectUri?: boolean;
}

/** Native Sign in with Apple credential, ready to post to the API. */
export interface AppleNativeCredential {
  identityToken: string;
  /** Full name — Apple only sends it on the very first consent. */
  name?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Port for running a provider's OAuth redirect. The only platform-aware
 * piece of the auth stack — everything else is provider-agnostic.
 */
export interface OAuthPort {
  /**
   * Opens the provider's prompt and resolves with the authorization code.
   * @throws {AuthFlowCancelled} when the user dismisses it.
   */
  authorize(provider: string): Promise<OAuthResult>;

  /**
   * Opens `url` in a browser session (custom tab / ASWebAuthenticationSession)
   * and resolves with the deep link it was redirected to — the transport for
   * server-mode providers. Resolves `null` when the user dismisses it.
   */
  openSession(url: string, redirectUri: string): Promise<string | null>;

  /**
   * Runs the native Sign in with Apple sheet. Resolves the credential, or
   * `null` when the platform has no native Apple flow (Android) so callers can
   * fall back to the server-side browser flow.
   *
   * @throws {AuthFlowCancelled} when the user dismisses the sheet.
   */
  authorizeAppleNative(): Promise<AppleNativeCredential | null>;
}

/**
 * Port for the Animu Auth API v5. Adapters wrap the `animu-api` package's
 * `AnimuAuth` client; the rest of the app never imports it directly.
 */
export interface AuthApiPort {
  setSessionToken(token: string | null): void;
  /** The token currently held by the API client, if any. */
  getSessionToken(): string | null;
  getProviders(): Promise<ProviderInfo[]>;
  /**
   * Start URL for the server-side mobile auth flow
   * (`/mobile/<provider>-start.php`). Pass a session token to link the
   * provider to that account (login when omitted).
   */
  mobileStartUrl(provider: string, sessionId?: string): string;
  /** Parses the server's deep-link bounce and adopts the session token. */
  completeMobileAuth(callbackUrl: string): MobileAuthRedirect;
  exchangeToken(params: AuthExchangeParams): Promise<AuthSession>;
  nativeLogin(params: AuthNativeLoginParams): Promise<AuthSession>;
  getSessionStatus(): Promise<AuthSessionStatus>;
  getProfile(): Promise<AuthProfile>;
  refreshProfile(): Promise<AuthRefreshResult>;
  linkProvider(params: AuthLinkParams): Promise<AuthLinkResult>;
  unlinkProvider(provider: string): Promise<AuthUnlinkResult>;
  setCredentials(
    params: AuthSetCredentialsParams,
  ): Promise<AuthCredentialsResult>;
  uploadAvatar(params: {
    avatar: Blob;
    filename?: string;
  }): Promise<string | null>;
  resetAvatar(): Promise<string | null>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
}

/** Persisted session: the token plus the last known user projection. */
export interface StoredSession {
  sessionToken: string;
  user: User;
}

/** Port for session persistence (AsyncStorage in production). */
export interface SessionStorePort {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}
