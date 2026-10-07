import { Directory, File, Paths } from "expo-file-system";
import type { CachedLookup, LyricsCache } from "@/core/lyrics/ports";

/** Lookups kept on disk; the oldest go first. */
const MAX_FILES = 400;
const FORMAT = 1;

/** FNV-1a, 32 bit: a file name for a song key (the key is stored inside). */
export function fileNameOf(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, "0")}-${key.length}.json`;
}

interface StoredLookup extends CachedLookup {
  format: number;
  key: string;
}

/**
 * One small JSON file per song in the cache directory: the OS may purge it
 * under storage pressure, which is only a cache miss. Unbounded growth is
 * trimmed on write.
 */
export class LyricsFileCache implements LyricsCache {
  private readonly dir = new Directory(Paths.cache, "lyrics");

  async read(key: string): Promise<CachedLookup | null> {
    const file = new File(this.dir, fileNameOf(key));
    if (!file.exists) return null;
    const stored = JSON.parse(await file.text()) as Partial<StoredLookup>;
    if (stored.format !== FORMAT || stored.key !== key) return null;
    if (typeof stored.savedAt !== "number" || !stored.result) return null;
    return { savedAt: stored.savedAt, result: stored.result };
  }

  async write(key: string, entry: CachedLookup): Promise<void> {
    if (!this.dir.exists) this.dir.create({ idempotent: true, intermediates: true });
    const file = new File(this.dir, fileNameOf(key));
    const stored: StoredLookup = { format: FORMAT, key, ...entry };
    file.write(JSON.stringify(stored));
    this.trim();
  }

  async size(): Promise<number> {
    return this.dir.exists ? (this.dir.size ?? 0) : 0;
  }

  async clear(): Promise<void> {
    if (this.dir.exists) this.dir.delete();
  }

  private trim(): void {
    const files = this.dir.list().filter((item): item is File => item instanceof File);
    if (files.length <= MAX_FILES) return;
    files
      .sort((a, b) => (a.modificationTime ?? 0) - (b.modificationTime ?? 0))
      .slice(0, files.length - MAX_FILES)
      .forEach((file) => file.delete());
  }
}
