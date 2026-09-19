import type {
  AnimuAuth,
  AuthEmailCodeParams,
  AuthEmailRequestResult,
  AuthEmailsResult,
  AuthExchangeParams,
  AuthLinkParams,
  AuthLinkResult,
  AuthProfile,
  AuthRefreshResult,
  AuthRemoveEmailResult,
  AuthSession,
  AuthSessionStatus,
  AuthUnlinkResult,
  MobileAuthRedirect,
  ProviderInfo,
} from "animu-api";
import { animuApi } from "@/api/client";
import type { AuthApiPort } from "@/core/auth/ports";

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

  mobileStartUrl(provider: string, sessionId?: string): string {
    return this.client.mobileStartUrl(provider, sessionId);
  }

  completeMobileAuth(callbackUrl: string): MobileAuthRedirect {
    return this.client.completeMobileAuth(callbackUrl);
  }

  exchangeToken(params: AuthExchangeParams): Promise<AuthSession> {
    return this.client.exchangeToken(params);
  }

  requestEmailLoginCode(email: string): Promise<AuthEmailRequestResult> {
    return this.client.requestEmailLoginCode(email);
  }

  verifyEmailLoginCode(params: AuthEmailCodeParams): Promise<AuthSession> {
    return this.client.verifyEmailLoginCode(params);
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

  getEmails(): Promise<AuthEmailsResult> {
    return this.client.getEmails();
  }

  requestAddEmail(email: string): Promise<AuthEmailRequestResult> {
    return this.client.requestAddEmail(email);
  }

  verifyAddEmail(params: AuthEmailCodeParams): Promise<AuthEmailsResult> {
    return this.client.verifyAddEmail(params);
  }

  removeEmail(emailId: number): Promise<AuthRemoveEmailResult> {
    return this.client.removeEmail(emailId);
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
