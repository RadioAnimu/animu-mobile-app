import type { CoverFileCache } from "@/core/player/storage/cover-ports";

/** In-memory lookup cap. The underlying files live in OS/SDK-owned cache
 * directories — only this lookup map is bounded here. */
export const DEFAULT_COVER_FILE_CACHE_CAPACITY = 64;

/**
 * The concrete hashmap behind {@link CoverFileCache}: insertion-ordered
 * LRU — `track()` deletes-then-sets so re-lookups recency-bump, and the
 * oldest entry is dropped past capacity. Lookups and writes on the same
 * map are JS-thread-serialized (single-threaded event loop), which makes
 * concurrent caller staleness impossible for the synchronous paths; the
 * async race (probe/download finishing out of order) is the resolver's
 * concern, not this map's.
 */
export class CoverFileHashMap implements CoverFileCache {
  private readonly entries = new Map<string, string>();
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_COVER_FILE_CACHE_CAPACITY) {
    if (capacity < 1) {
      throw new RangeError("CoverFileHashMap capacity must be ≥ 1");
    }
    this.capacity = capacity;
  }

  peek(url: string): string | undefined {
    return this.entries.get(url);
  }

  track(url: string, fileUri: string): void {
    this.entries.delete(url);
    this.entries.set(url, fileUri);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest != null) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
