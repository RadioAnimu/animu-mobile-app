import { decodeEntry, encodeEntry, fileNameOf, MAX_ENTRIES, TRIM_SLACK } from "@/core/lyrics/cache-entry";
import type { CachedLookup, LyricsCache } from "@/core/lyrics/ports";
import { WebStore } from "@/utils/web-store";

/** Web build: one JSON entry per song in Cache Storage, trimmed on write. */
export class LyricsFileCache implements LyricsCache {
  private readonly store = new WebStore("lyrics");

  async read(key: string): Promise<CachedLookup | null> {
    const text = await this.store.text(fileNameOf(key));
    return text === null ? null : decodeEntry(text, key);
  }

  async write(key: string, entry: CachedLookup): Promise<void> {
    await this.store.write(fileNameOf(key), encodeEntry(key, entry));
    await this.trim();
  }

  private async trim(): Promise<void> {
    const entries = await this.store.list();
    if (entries.length < MAX_ENTRIES + TRIM_SLACK) return;
    entries.sort((a, b) => a.savedAt - b.savedAt);
    await Promise.all(entries.slice(0, entries.length - MAX_ENTRIES).map((entry) => this.store.remove(entry.name)));
  }
}
