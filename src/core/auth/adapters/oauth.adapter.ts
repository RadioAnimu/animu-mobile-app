import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleSignin,
  isCancelledResponse,
} from "@react-native-google-signin/google-signin";
import {
  getProviderConfig,
  redirectUriForProvider,
  resolveClientId,
  type OauthProviderConfig,
} from "../../../constants/auth";
import { AuthFlowCancelled } from "../errors";
import type { OAuthPort, OAuthResult } from "../ports";

// ─── Native Google ──────────────────────────────────────────────────────

let googleConfigured = false;

function configureGoogle(config: OauthProviderConfig): void {
  if (googleConfigured) return;
  GoogleSignin.configure({
    // The native SDK takes the *web* client id here; it's the "server
    // client id" the returned server auth code is bound to.
    webClientId: config.clientId,
    iosClientId: config.iosClientId || undefined,
    offlineAccess: true,
    scopes: ["openid", "email", "profile"],
  });
  googleConfigured = true;
}

async function authorizeGoogle(config: OauthProviderConfig): Promise<OAuthResult> {
  configureGoogle(config);

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
  }

  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) throw new AuthFlowCancelled();
  if (response.type !== "success") {
    throw new Error("Google sign-in did not complete");
  }

  const code = response.data.serverAuthCode;
  if (!code) {
    throw new Error(
      "Google did not return a server auth code — check the web client id",
    );
  }
  // No redirect URI: the backend redeems this server auth code with the web
  // client secret.
  return { code, omitRedirectUri: true };
}

// ─── Native Apple ───────────────────────────────────────────────────────

async function authorizeApple(): Promise<OAuthResult> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error("Apple sign-in is not available here");

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.authorizationCode) {
    throw new Error("Apple did not return an authorization code");
  }
  // Apple only sends the name/email on first consent; forward them.
  const user = JSON.stringify({
    name: credential.fullName,
    email: credential.email,
  });
  return { code: credential.authorizationCode, omitRedirectUri: true, user };
}

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
 * Dispatches each provider to the right transport: the native SDKs for
 * Google/Apple (they return a server auth code / identity token) and
 * `expo-auth-session` for browser OAuth providers (Discord).
 */
export class OAuthAdapter implements OAuthPort {
  async authorize(provider: string): Promise<OAuthResult> {
    const config = getProviderConfig(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    if (config.comingSoon) {
      throw new Error(`Provider "${provider}" is not available yet`);
    }

    if (config.mode === "native") {
      if (provider === "google") return authorizeGoogle(config);
      if (provider === "apple") return authorizeApple();
    }

    return authorizeBrowser(provider, config);
  }
}
