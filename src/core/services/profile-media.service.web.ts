export type ProfileMediaKind = "avatar" | "banner";

/** The URL each avatar/banner was last synced to, by kind and user. */
const urls = new Map<string, string>();
const keyOf = (kind: ProfileMediaKind, userId: number) => `${kind}-${userId}`;

/** The URL synced this session, if any. */
export function getCachedProfileMedia(kind: ProfileMediaKind, userId: number): string | null {
  return urls.get(keyOf(kind, userId)) ?? null;
}

/**
 * Web build: the browser's HTTP cache keeps images, so the URL is used as is.
 * (Media behind the login server needs a session, which the web build can't
 * have yet — see docs/WEB.md.)
 *
 * @returns the URL to render, or `null` when there is none.
 */
export async function syncProfileMedia(
  kind: ProfileMediaKind,
  userId: number,
  url: string | null | undefined,
  _sessionToken: string | null | undefined,
): Promise<string | null> {
  const key = keyOf(kind, userId);
  if (!url) {
    urls.delete(key);
    return null;
  }
  urls.set(key, url);
  return url;
}

/** Drops every synced avatar/banner (logout, account deletion). */
export function clearProfileMedia() {
  urls.clear();
}
