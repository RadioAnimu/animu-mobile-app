import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  getProviderConfig,
  redirectUriForProvider,
  resolveClientId,
  type OauthProviderConfig,
} from "@/constants/auth";
import { AuthFlowCancelled } from "@/core/auth/errors";
import type {
  AppleNativeCredential,
  OAuthPort,
  OAuthResult,
} from "@/core/auth/ports";

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

// ─── Native Apple ───────────────────────────────────────────────────────

/** Maps the native `fullName` object to the API's flat name fields. */
function appleName(credential: AppleAuthentication.AppleAuthenticationCredential): {
  name?: string;
  firstName?: string;
  lastName?: string;
} {
  const firstName = credential.fullName?.givenName ?? undefined;
  const lastName = credential.fullName?.familyName ?? undefined;
  const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;
  return { name, firstName, lastName };
}

/**
 * Client-side OAuth transports. `"server"` providers (Discord/Google/Apple)
 * defer the redirect to the backend — `openSession` opens its start URL and
 * returns the deep link the server bounces. Sign in with Apple also has a
 * native iOS path (`authorizeAppleNative`); Android falls back to the server
 * flow. `"browser"` (expo-auth-session) remains available for app-driven
 * redirects.
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

  async authorizeAppleNative(): Promise<AppleNativeCredential | null> {
    if (Platform.OS !== "ios") return null;
    if (!(await AppleAuthentication.isAvailableAsync())) return null;

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    }).catch((error: unknown) => {
      if (
        (error as { code?: string } | undefined)?.code ===
        "ERR_REQUEST_CANCELED"
      ) {
        throw new AuthFlowCancelled();
      }
      throw error;
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token");
    }

    return {
      identityToken: credential.identityToken,
      ...appleName(credential),
    };
  }
}
