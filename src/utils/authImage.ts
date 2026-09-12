import type { ImageSource } from "expo-image";
import { ENDPOINTS } from "animu-api";

/**
 * Builds an `expo-image` source for an avatar/banner URL.
 *
 * The Auth API returns authenticated media as a relative
 * `…/api/v5/me/avatar.php` URL, which 401s without the session. For those
 * same-origin URLs we attach `X-Session-Id` and a `v` cache-buster (the
 * endpoint URL never changes, so expo-image would otherwise serve the
 * stale image after an upload). Provider CDN URLs are passed through
 * untouched.
 */
export function buildAuthImageSource(
  uri: string | null | undefined,
  sessionToken: string | null | undefined,
  revision: string | number,
): ImageSource | undefined {
  if (!uri) return undefined;
  if (!uri.startsWith(ENDPOINTS.auth)) return { uri };

  const separator = uri.includes("?") ? "&" : "?";
  return {
    uri: `${uri}${separator}v=${revision}`,
    headers: sessionToken ? { "X-Session-Id": sessionToken } : undefined,
  };
}
