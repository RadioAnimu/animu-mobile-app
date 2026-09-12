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
}

/**
 * Port for the Animu Auth API v5. Adapters wrap the `animu-api` package's
 * `AnimuAuth` client; the rest of the app never imports it directly.
 */
export interface AuthApiPort {
  setSessionToken(token: string | null): void;
  getProviders(): Promise<ProviderInfo[]>;
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
