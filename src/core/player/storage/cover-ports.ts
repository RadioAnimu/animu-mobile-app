/**
 * Cover-cache ports (hexagonal) — interfaces over the artwork hashmap and
 * the disk cache it talks to. Implementations live in `cover-file-cache.ts`
 * (pure LRU hashmap) and `cover-image-cache.ts` (expo-image adapters), so
 * every consumer is unit-testable without touching native modules.
 */

/** LRU-bounded hashmap: remote cover URL → local `file://` URI. */
export interface CoverFileCache {
  /** O(1) sync lookup — does not refresh recency (peeking is free). */
  peek(url: string): string | undefined;
  /** Inserts or bumps a URL to the most-recent position, evicting LRU entries beyond capacity. */
  track(url: string, fileUri: string): void;
  /** Live number of tracked URLs. */
  readonly size: number;
  /** Drops every lookup (called on the resolver's destroy path). */
  clear(): void;
}

/** Disk-image-cache surface the adapters can be built over (expo-image today, anything tomorrow). */
export interface CoverDiskCache {
  /** Path of the cached file for `cacheKey`; `null` when never cached or evicted. */
  getCachePath(cacheKey: string): Promise<string | null>;
  /** Registers an existing local file under `cacheKey` (seeding). */
  writeCache(source: string, cacheKey: string): Promise<void>;
}

/** Local `file://` URI for an already-cached copy of a cover, or `null`. */
export type FindCachedCoverFile = (url: string) => Promise<string | null>;

/** Seed type — registers a downloaded file under its original remote URL. */
export type SeedCoverCache = (localUri: string, remoteUrl: string) => Promise<void>;
