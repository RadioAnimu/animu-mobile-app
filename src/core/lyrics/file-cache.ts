import { Directory, File, Paths } from "expo-file-system";
import { decodeEntry, encodeEntry, fileNameOf, MAX_ENTRIES, TRIM_SLACK } from "@/core/lyrics/cache-entry";
import type { CachedLookup, LyricsCache } from "@/core/lyrics/ports";

/**
 * One small JSON file per song in the cache directory: the OS may purge it
 * under storage pressure, which is only a cache miss. Unbounded growth is
 * trimmed on write.
 */
export class LyricsFileCache implements LyricsCache {
  private readonly dir = new Directory(Paths.cache, "lyrics");

  async read(key: string): Promise<CachedLookup | null> {
    const file = new File(this.dir, fileNameOf(key));
    return file.exists ? decodeEntry(await file.text(), key) : null;
  }

  async write(key: string, entry: CachedLookup): Promise<void> {
    if (!this.dir.exists) this.dir.create({ idempotent: true, intermediates: true });
    new File(this.dir, fileNameOf(key)).write(encodeEntry(key, entry));
    this.trim();
  }

  private trim(): void {
    const files = this.dir.list().filter((item): item is File => item instanceof File);
    if (files.length < MAX_ENTRIES + TRIM_SLACK) return;
    // Read `lastModified` once per file: it is a synchronous native call, and
    // a comparator would re-read it O(n log n) times.
    const stamped = files.map((file) => ({
      file,
      modified: file.lastModified ?? 0,
    }));
    stamped.sort((a, b) => a.modified - b.modified);
    for (const { file } of stamped.slice(0, files.length - MAX_ENTRIES)) {
      file.delete();
    }
  }
}
