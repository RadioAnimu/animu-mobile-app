import type {
  AnimuAuth,
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
  MobileGoogleRedirect,
  ProviderInfo,
} from "animu-api";
import { animuApi } from "../../../api/client";
import type { AuthApiPort } from "../ports";

/**
 * Adapter over the `animu-api` package's `AnimuAuth` client.
 *
 * It exists so the app depends on {@link AuthApiPort} (our vocabulary)
 * instead of the package's concrete class: swapping the package, mocking
 * it in tests, or layering caching all happen behind this boundary.
 */
export class AnimuAuthAdapter implements AuthApiPort {
  private readonly client: AnimuAuth;

  constructor(client: AnimuAuth = animuApi.auth) {
    this.client = client;
  }

  setSessionToken(token: string | null): void {
    this.client.setSessionToken(token);
  }

  getSessionToken(): string | null {
    return this.client.sessionToken;
  }

  getProviders(): Promise<ProviderInfo[]> {
    return this.client.getProviders();
  }

  googleMobileStartUrl(sessionId?: string): string {
    return this.client.googleMobileStartUrl(sessionId);
  }

  completeMobileGoogleLogin(callbackUrl: string): MobileGoogleRedirect {
    return this.client.completeMobileGoogleLogin(callbackUrl);
  }

  exchangeToken(params: AuthExchangeParams): Promise<AuthSession> {
    return this.client.exchangeToken(params);
  }

  nativeLogin(params: AuthNativeLoginParams): Promise<AuthSession> {
    return this.client.nativeLogin(params);
  }

  getSessionStatus(): Promise<AuthSessionStatus> {
    return this.client.getSessionStatus();
  }

  getProfile(): Promise<AuthProfile> {
    return this.client.getProfile();
  }

  refreshProfile(): Promise<AuthRefreshResult> {
    return this.client.refreshProfile();
  }

  linkProvider(params: AuthLinkParams): Promise<AuthLinkResult> {
    return this.client.linkProvider(params);
  }

  unlinkProvider(provider: string): Promise<AuthUnlinkResult> {
    return this.client.unlinkProvider(provider);
  }

  setCredentials(
    params: AuthSetCredentialsParams,
  ): Promise<AuthCredentialsResult> {
    return this.client.setCredentials(params);
  }

  uploadAvatar(params: {
    avatar: Blob;
    filename?: string;
  }): Promise<string | null> {
    return this.client.uploadAvatar(params);
  }

  resetAvatar(): Promise<string | null> {
    return this.client.resetAvatar();
  }

  async logout(): Promise<void> {
    await this.client.logout();
  }

  async deleteAccount(): Promise<void> {
    await this.client.deleteAccount();
  }
}
