import * as AuthSession from "expo-auth-session";

/**
 * The sign-in providers the app offers. Every one runs server-side: the app
 * opens the backend's `/mobile/<provider>-start.php` in a browser session and
 * adopts the session token it bounces to {@link AUTH_REDIRECT_URI} — no client
 * ids, SDKs or platform registration here. Providers advertised by
 * `AnimuAuth.getProviders()` but missing here still render, disabled.
 */

/** Deep link the server flow bounces back to (`animuapp://redirect`). */
export const AUTH_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "animuapp",
  path: "redirect",
});

export interface OauthProviderConfig {
  name: string;
  label: string;
  /**
   * `"apple"`: prefer the native iOS sheet (`expo-apple-authentication`
   * identity token); elsewhere the server flow.
   */
  native?: "apple";
}

const OAUTH_PROVIDERS: Record<string, OauthProviderConfig> = {
  discord: { name: "discord", label: "Discord" },
  google: { name: "google", label: "Google" },
  fluxer: { name: "fluxer", label: "Fluxer" },
  apple: { name: "apple", label: "Apple", native: "apple" },
};

/** Animu Connect (passwordless email codes) is not an OAuth provider. */
const ANIMU_CONNECT = {
  name: "animu",
  label: "Animu Connect",
} as const;

/**
 * Initial button list, replaced by `getProviders()` once it resolves (and
 * kept when it is unreachable, so the UI still works).
 */
export const DEFAULT_PROVIDERS = Object.values(OAUTH_PROVIDERS).map(({ name, label }) => ({ name, label }));

export function getProviderConfig(
  name: string,
): OauthProviderConfig | undefined {
  return OAUTH_PROVIDERS[name];
}

/** `true` for a provider the app can sign in with — and link from the Account screen. */
export function isProviderConfigured(name: string): boolean {
  return getProviderConfig(name) !== undefined;
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
