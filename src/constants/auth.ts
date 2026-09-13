import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";

/**
 * Client-side OAuth metadata for the Animu Auth API v5.
 *
 * The `animu-api` package owns transport, schemas and session handling; this
 * file owns what it deliberately stays out of: client ids, authorize
 * endpoints and scopes. Providers advertised by `AnimuAuth.getProviders()`
 * but missing here still render (disabled) until their credentials are set.
 */

/** Deep link the OAuth providers redirect back to (`animuapp://redirect`). */
export const AUTH_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "animuapp",
  path: "redirect",
});

export interface OauthProviderConfig {
  name: string;
  label: string;
  authorizationEndpoint: string;
  scopes: string[];
  /** Default (web) client id — also the fallback for both platforms. */
  clientId: string;
  /** Platform client ids (iOS/Android OAuth clients). */
  iosClientId?: string;
  androidClientId?: string;
  /**
   * `"browser"` (default) runs the OAuth redirect through
   * `expo-auth-session`; `"server"` delegates the whole redirect to the
   * backend (`loginWithProvider` opens its start URL in a browser session and
   * adopts the session token from the deep-link bounce — no client id, SDK,
   * package or SHA-1 registration); `"native"` uses the platform SDK
   * (`AppleAuthentication`).
   */
  mode?: "browser" | "native" | "server";
  /**
   * Whether the provider can be linked from the Account screen. Defaults to
   * `true`; set `false` for server-mode providers that only support login.
   */
  linkable?: boolean;
  /** Rendered as disabled/"coming soon" until the backend supports it. */
  comingSoon?: boolean;
  /**
   * Redirect registered with the provider. Defaults to
   * {@link AUTH_REDIRECT_URI} (`animuapp://redirect`). Only used in browser
   * mode.
   */
  redirectUri?: string;
  usePKCE?: boolean;
  extraParams?: Record<string, string>;
}

/**
 * OAuth providers we can start a login for. `TODO(client-id)` entries need a
 * mobile client registered with the provider before that button can complete.
 */
export const OAUTH_PROVIDERS: Record<string, OauthProviderConfig> = {
  discord: {
    name: "discord",
    label: "Discord",
    authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
    scopes: ["identify"],
    clientId: "1159273876732256266",
    mode: "browser",
    usePKCE: true,
  },
  google: {
    name: "google",
    label: "Google",
    // Server-side flow: the backend owns the Google OAuth client, the PKCE
    // verifier and the redirect, so the app carries no client id at all. It
    // just opens `googleMobileStartUrl()` in a browser session and adopts the
    // session token the server bounces to `animuapp://redirect`, which is why
    // this works regardless of how the APK was signed (no SHA-1 registration).
    // Linking reuses the same URL with the current token appended as `?sid=`.
    authorizationEndpoint: "",
    scopes: [],
    clientId: "",
    mode: "server",
    linkable: true,
  },
  apple: {
    name: "apple",
    label: "Apple",
    authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
    scopes: ["name", "email"],
    // Native `expo-apple-authentication` needs no client id; kept disabled
    // until the backend can verify the Apple identity token.
    clientId: "",
    mode: "native",
    comingSoon: true,
    usePKCE: true,
  },
};

/** Animu Connect (native username/password) is not an OAuth provider. */
export const ANIMU_CONNECT = {
  name: "animu",
  label: "Animu Connect",
} as const;

/** Rendered when `getProviders()` is unreachable, so the UI still works. */
export const FALLBACK_PROVIDERS = ["discord", "google", "apple"] as const;

/** Initial button list, replaced by `getProviders()` once it resolves. */
export const DEFAULT_PROVIDERS = FALLBACK_PROVIDERS.map((name) => ({
  name,
  label: OAUTH_PROVIDERS[name]?.label ?? name,
}));

export function getProviderConfig(
  name: string,
): OauthProviderConfig | undefined {
  return OAUTH_PROVIDERS[name];
}

/** Picks the platform-specific client id, falling back to the default one. */
export function resolveClientId(config: OauthProviderConfig): string {
  const platformId = Platform.select({
    ios: config.iosClientId,
    android: config.androidClientId,
    default: config.clientId,
  });
  return platformId || config.clientId;
}

/** `true` once the provider can actually be used on this platform. */
export function isProviderConfigured(name: string): boolean {
  const config = getProviderConfig(name);
  if (!config || config.comingSoon) return false;
  // Server-mode providers need no client-side credentials.
  if (config.mode === "server") return true;
  return !!resolveClientId(config);
}

/**
 * `true` when the Account screen may offer to *link* the provider. Server-mode
 * providers default to login-only unless they opt in with `linkable: true`.
 */
export function isProviderLinkable(name: string): boolean {
  const config = getProviderConfig(name);
  if (!config || config.comingSoon) return false;
  if (config.mode === "server") return config.linkable === true;
  return isProviderConfigured(name);
}

/**
 * Redirect URI for a browser-mode provider's authorize step (and the
 * matching code exchange). Native-mode providers omit it entirely.
 */
export function redirectUriForProvider(name: string): string {
  return getProviderConfig(name)?.redirectUri ?? AUTH_REDIRECT_URI;
}

/**
 * Human label for a provider name. The Auth API reports the native login as
 * `"native"` (and we sometimes reference it as `"animu"`) — both surface as
 * "Animu Connect".
 */
export function providerLabel(name: string, fallback?: string): string {
  if (name === "native" || name === ANIMU_CONNECT.name) {
    return ANIMU_CONNECT.label;
  }
  return getProviderConfig(name)?.label ?? fallback ?? name;
}
