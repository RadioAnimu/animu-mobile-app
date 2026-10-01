import { Directory, File, Paths } from "expo-file-system";
import { ENDPOINTS } from "animu-api";

export type ProfileMediaKind = "avatar" | "banner";

const DIR_NAME = "profile-media";

function mediaDir(): Directory {
  const dir = new Directory(Paths.cache, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function prefix(kind: ProfileMediaKind, userId: number): string {
  return `${kind}-${userId}-`;
}

function filesFor(kind: ProfileMediaKind, userId: number): File[] {
  const dir = mediaDir();
  return dir
    .list()
    .filter(
      (entry): entry is File =>
        entry instanceof File && entry.name.startsWith(prefix(kind, userId)),
    );
}

function safeDelete(file: File) {
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.warn("[ProfileMedia] delete failed:", error);
  }
}

/** The locally saved copy of the user's avatar/banner, if any. */
export function getCachedProfileMedia(
  kind: ProfileMediaKind,
  userId: number,
): string | null {
  try {
    return filesFor(kind, userId)[0]?.uri ?? null;
  } catch (error) {
    console.warn("[ProfileMedia] read failed:", error);
    return null;
  }
}

/**
 * Downloads the current avatar/banner bytes and keeps them on disk.
 *
 * The server serves these from stable URLs (the bytes change, the URL does
 * not), so the image library can't tell when they change. The copy is
 * therefore named after its content hash: unchanged bytes keep the same file
 * (and the same image-cache entry), changed bytes get a brand-new URI that
 * can never be served stale. Older copies are removed.
 *
 * - `url` null → the account has no such media; any saved copy is dropped.
 * - Network/server failure → the existing saved copy is kept and returned.
 *
 * @returns the local `file://` URI to render, or `null` when there is none.
 */
export function syncProfileMedia(
  kind: ProfileMediaKind,
  userId: number,
  url: string | null | undefined,
  sessionToken: string | null | undefined,
): Promise<string | null> {
  // Syncs for the same media run one after another: they share one download
  // slot, so an overlapping call can't clobber the other's half-written file.
  const key = `${kind}-${userId}`;
  const run = (syncChains.get(key) ?? Promise.resolve()).then(() =>
    runSync(kind, userId, url, sessionToken),
  );
  const tail = run.catch(() => undefined);
  syncChains.set(key, tail);
  void tail.then(() => {
    if (syncChains.get(key) === tail) syncChains.delete(key);
  });
  return run;
}

const syncChains = new Map<string, Promise<unknown>>();

async function runSync(
  kind: ProfileMediaKind,
  userId: number,
  url: string | null | undefined,
  sessionToken: string | null | undefined,
): Promise<string | null> {
  if (!url) {
    removeProfileMedia(kind, userId);
    return null;
  }

  const pending = new File(mediaDir(), `pending-${kind}-${userId}`);
  try {
    const authed = url.startsWith(ENDPOINTS.auth);
    await File.downloadFileAsync(url, pending, {
      idempotent: true,
      headers:
        authed && sessionToken ? { "X-Session-Id": sessionToken } : undefined,
    });
    const { md5 } = pending.info({ md5: true });
    if (!md5) throw new Error("no hash for downloaded media");

    const target = new File(mediaDir(), `${prefix(kind, userId)}${md5}`);
    if (target.exists) {
      safeDelete(pending);
    } else {
      pending.move(target);
    }
    for (const stale of filesFor(kind, userId)) {
      if (stale.uri !== target.uri) safeDelete(stale);
    }
    return target.uri;
  } catch (error) {
    console.warn(`[ProfileMedia] ${kind} sync failed:`, error);
    safeDelete(pending);
    return getCachedProfileMedia(kind, userId);
  }
}

export function removeProfileMedia(kind: ProfileMediaKind, userId: number) {
  try {
    for (const file of filesFor(kind, userId)) safeDelete(file);
  } catch (error) {
    console.warn("[ProfileMedia] remove failed:", error);
  }
}

/** Drops every saved avatar/banner (logout, account deletion). */
export function clearProfileMedia() {
  try {
    const dir = new Directory(Paths.cache, DIR_NAME);
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn("[ProfileMedia] clear failed:", error);
  }
}
