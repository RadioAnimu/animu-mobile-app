import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  getProviderConfig,
  redirectUriForProvider,
  resolveClientId,
  type OauthProviderConfig,
} from "../../../constants/auth";
import { AuthFlowCancelled } from "../errors";
import type { OAuthPort, OAuthResult } from "../ports";

// ─── Browser (expo-auth-session) ────────────────────────────────────────

async function authorizeBrowser(
  provider: string,
  config: OauthProviderConfig,
): Promise<OAuthResult> {
  const clientId = resolveClientId(config);
  if (!clientId) {
    throw new Error(`Provider "${provider}" is not configured yet`);
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: config.scopes,
    redirectUri: redirectUriForProvider(provider),
    responseType: AuthSession.ResponseType.Code,
    usePKCE: config.usePKCE ?? true,
    extraParams: config.extraParams,
  });

  const result = await request.promptAsync({
    authorizationEndpoint: config.authorizationEndpoint,
  });

  if (result.type !== "success") {
    if (result.type === "error") {
      throw new Error(result.error?.message ?? "Authorization failed");
    }
    throw new AuthFlowCancelled();
  }

  const params = result.params as Record<string, string | undefined>;
  if (!params.code) {
    throw new Error("Authorization response is missing a code");
  }

  return {
    code: params.code,
    codeVerifier: request.codeVerifier,
    user: params.user,
  };
}

/**
 * Client-side OAuth transports. `"browser"` (Discord) runs the redirect itself
 * via `expo-auth-session`; `"server"` (Google) defers to the backend, so here
 * we only open its start URL and hand back the deep link the server bounces
 * (`openSession`). Native SDKs are gone — Apple stays disabled for now.
 */
export class OAuthAdapter implements OAuthPort {
  async authorize(provider: string): Promise<OAuthResult> {
    const config = getProviderConfig(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    if (config.comingSoon) {
      throw new Error(`Provider "${provider}" is not available yet`);
    }
    if (config.mode === "server") {
      throw new Error(
        `Provider "${provider}" runs server-side; use AuthFacade.loginWithProvider`,
      );
    }
    if (config.mode === "native") {
      throw new Error(`Provider "${provider}" is not available yet`);
    }

    return authorizeBrowser(provider, config);
  }

  async openSession(url: string, redirectUri: string): Promise<string | null> {
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    if (result.type === "success") return result.url;
    if (result.type === "cancel" || result.type === "dismiss") return null;
    throw new Error(`Browser session ended unexpectedly (${result.type})`);
  }
}
