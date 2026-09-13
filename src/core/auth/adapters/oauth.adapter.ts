import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
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

  const response = await GoogleSignin.signIn().catch((error: unknown) => {
    // `DEVELOPER_ERROR` (native code 10) on Android means the OAuth client's
    // registered SHA-1 does not match the certificate this build was signed
    // with. It is almost always a release/Play App Signing fingerprint that
    // was never added to the Google Cloud console.
    const code = (error as { code?: string | number } | undefined)?.code;
    const message = (error as { message?: string } | undefined)?.message ?? "";
    if (code === 10 || message.includes("DEVELOPER_ERROR")) {
      throw new Error(
        "Google sign-in misconfigured (DEVELOPER_ERROR): register this build's SHA-1 " +
          "certificate for package com.nessjs.animu in the Google Cloud console. " +
          "EAS release and Google Play App Signing keys are different from the local debug key.",
      );
    }
    throw error;
  });
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

    // Native Apple is stubbed out until the backend can verify its identity
    // token and the app has code signing configured (the `applesignin`
    // entitlement requires it). It stays `comingSoon`, so this is unreachable.
    if (config.mode === "native" && provider === "google") {
      return authorizeGoogle(config);
    }

    return authorizeBrowser(provider, config);
  }
}
