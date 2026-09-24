import { Image } from "expo-image";
import { File } from "expo-file-system";

import {
  coverCacheRegistry,
  type CoverCacheCategory,
} from "@/core/services/cover-cache-registry.service";
import {
  CATEGORY_ORDER,
  resolvePartitionCaps,
  type CoverCachePartitions,
} from "@/core/services/cover-cache-partitions";

export type { CoverCachePartitions };

/**
 * Grace window for a freshly-tagged URL whose bytes are still seeding into
 * the image cache (the resolver's `writeCache` races this measure). Absent
 * this window the measure would prune the tag before the bytes land, and
 * nothing would ever re-tag that cover.
 */
const SEED_GRACE_MS = 60_000;

export type CoverStorageKey = CoverCacheCategory;

export interface CoverStorageSlice {
  key: CoverStorageKey;
  /** Bytes of cached files found on disk under this category. */
  bytes: number;
  /** Files found on disk under this category. */
  count: number;
}

export interface CoverStorageSnapshot {
  slices: CoverStorageSlice[];
  totalBytes: number;
  totalCount: number;
}

/** Result of one byte-limit enforcement pass (`trim`, or the pass
    embedded in `computeSnapshot`). */
export interface CoverCacheTrimResult {
  /** URLs whose cache files were deleted — oldest displayed first. */
  evicted: string[];
  /** Bytes actually reclaimed (0 when nothing needed removing). */
  freedBytes: number;
  /** Measured bytes still cached after the pass. */
  remainingBytes: number;
}

/**
 * stat result for one tracked URL:
 * - `found`   → bytes measured from the real cached file;
 * - `absent`  → expo-image positively reports no cached file (safe to prune);
 * - `unknown` → the stat itself failed; the file may exist — the entry is
 *   kept but contributes no bytes until a later measure resolves it.
 */
type CachedStat =
  | { state: "found"; bytes: number }
  | { state: "absent" }
  | { state: "unknown" };

/**
 * expo-image's Android impl returns Glide's `file.absolutePath` — a bare
 * filesystem path with no scheme. The new expo-file-system `File` class
 * requires an absolute URI ("URI is not absolute" otherwise), so prefix
 * the scheme here while leaving existing `file://` strings untouched.
 */
function toFileUri(path: string): string {
  return /^file:\/\//.test(path) ? path : `file://${path}`;
}

/** Disk bytes for one URL via expo-image's own cache-key lookup. */
async function cachedFileBytes(url: string): Promise<CachedStat> {
  try {
    const path = await Image.getCachePathAsync(url);
    if (!path) return { state: "absent" };
    const file = new File(toFileUri(path));
    return file.exists && file.size > 0
      ? { state: "found", bytes: file.size }
      : { state: "absent" };
  } catch (error) {
    console.warn("[CoverDiskStorage] stat failed:", error);
    return { state: "unknown" };
  }
}

/**
 * Deletes the file behind expo-image's cache key for one URL. The glob
 * registry's measurement uses the exact same lookup, so the path stat'd
 * found is the path deleted — Glide keeps its own journal, so stat →
 * delete → later stat reads "absent" and the ghost entry heals itself
 * out of the registry.
 */
async function deleteCachedFile(url: string): Promise<boolean> {
  try {
    const path = await Image.getCachePathAsync(url);
    if (!path) return false;
    const file = new File(toFileUri(path));
    if (!file.exists) return false;
    file.delete();
    return true;
  } catch (error) {
    console.warn("[CoverDiskStorage] evict failed:", error);
    return false;
  }
}

/**
 * Answers "how much disk do cached covers take" per app category by
 * stat'ing the real files expo-image stores (one lookup per tracked URL,
 * batched). Registry URLs whose files were evicted are pruned so the
 * legend never shows ghosts.
 *
 * When a `maxBytes` limit is given, the same pass also runs the FIFO
 * byte trim: the ring is the registry's recency order — oldest displayed
 * covers are deleted (and deregistered) until the measured total fits.
 */
export class CoverDiskStorage {
  /** Shared wipe-in-progress flag — the Settings toggle and the storage
      card's clean button both disable themselves while any wipe runs
      (the clean button AND the automatic wipe on cache-off come through
      `clearAll`, so this is the one source of truth). */
  private clearListeners = new Set<() => void>();
  private clearing = false;

  /** Serialization chain — snapshots, trims and wipes never interleave:
      (measure → decide → delete → prune) is atomic relative to another
      pass or a `clearAll`, so bytes are never accounted twice and a wipe
      can never resurrect a file a mid-flight trim just dropped. */
  private workChain: Promise<unknown> = Promise.resolve();

  get isClearing(): boolean {
    return this.clearing;
  }

  /** Pub/sub for the `clearing` flag — React ties it in with
      `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void {
    this.clearListeners.add(listener);
    return () => this.clearListeners.delete(listener);
  }

  private setClearing(next: boolean): void {
    if (this.clearing === next) return;
    this.clearing = next;
    for (const listener of this.clearListeners) listener();
  }

  /** Queues an operation behind every queued one already running; the
      chain itself swallows errors so one failed pass never poisons the
      next, while the caller still gets its own rejection. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.workChain.then(operation);
    this.workChain = result.catch(() => {});
    return result;
  }

  async clearAll(): Promise<void> {
    await this.enqueue(async () => {
      this.setClearing(true);
      try {
        await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
        await coverCacheRegistry.clear();
      } finally {
        this.setClearing(false);
      }
    });
  }

  /**
   * Measures every tracked URL and, when over the per-partition caps
   * (computed from `maxBytes` + optional custom overrides), walks each
   * partition's FIFO ring hard-deleting cache files until back under
   * its own budget. Serialized so lowering the limit in Settings and a
   * storage card re-measure can never delete the same URL twice or
   * fight a wipe.
   */
  async trim(
    maxBytes: number,
    partitions: CoverCachePartitions | null = null,
  ): Promise<CoverCacheTrimResult | null> {
    return this.enqueue(async () => {
      if (maxBytes <= 0 || this.clearing) return null;
      await coverCacheRegistry.load();
      const groups = coverCacheRegistry.groupByCategory();
      const statByUrl = await this.statAll(groups);
      const result = await this.evictPartitions(
        groups,
        statByUrl,
        resolvePartitionCaps(maxBytes, partitions),
      );
      if (result.evicted.length > 0) {
        await coverCacheRegistry.prune(result.evicted);
      }
      return result;
    });
  }

  async computeSnapshot(
    maxBytes = 0,
    partitions: CoverCachePartitions | null = null,
  ): Promise<CoverStorageSnapshot> {
    return this.enqueue(async () => {
      await coverCacheRegistry.load();

      const groups = coverCacheRegistry.groupByCategory();
      const statByUrl = await this.statAll(groups);

      const { evicted } = await this.evictPartitions(
        groups,
        statByUrl,
        resolvePartitionCaps(maxBytes, partitions),
      );
      const evictedSet = new Set(evicted);

      // Positively-absent files (Glide evicted them at its own will) are
      // pruned exactly like before; evicted-by-limit URLs join the same
      // batch so the registry forgets them in one persist. A freshly-
      // tagged URL rides out the seed grace instead — its bytes may be
      // mid-write into the image cache.
      const missing = [...statByUrl.entries()]
        .filter(([url, stat]) => stat.state === "absent" && !evictedSet.has(url))
        .map(([url]) => url)
        .filter((url) => {
          const taggedAt = coverCacheRegistry.taggedAt(url);
          return taggedAt == null || taggedAt <= Date.now() - SEED_GRACE_MS;
        });
      await coverCacheRegistry.prune([...evictedSet, ...missing]);

      const freshGroups = coverCacheRegistry.groupByCategory();
      const slices: CoverStorageSlice[] = CATEGORY_ORDER.map((key) => {
        let bytes = 0;
        let count = 0;
        for (const url of freshGroups[key]) {
          const stat = statByUrl.get(url);
          // A tag that raced the prune added an URL this pass never
          // stat'd — it contributes nothing on this pass (next measure
          // resolves it), same policy as `unknown`.
          if (stat?.state === "found") {
            bytes += stat.bytes;
            count++;
          }
        }
        return { key, bytes, count };
      });

      return {
        slices,
        totalBytes: slices.reduce((sum, slice) => sum + slice.bytes, 0),
        totalCount: slices.reduce((sum, slice) => sum + slice.count, 0),
      };
    });
  }

  /** One stat per tracked URL, batched, keyed back by URL. */
  private async statAll(
    groups: Record<CoverStorageKey, string[]>,
  ): Promise<Map<string, CachedStat>> {
    const urls = [...new Set(Object.values(groups).flat())];
    const stats = await Promise.all(urls.map(cachedFileBytes));
    const statByUrl = new Map<string, CachedStat>();
    for (let index = 0; index < urls.length; index++) {
      statByUrl.set(urls[index], stats[index]);
    }
    return statByUrl;
  }

  /**
   * The FIFO ring walk, per partition: each category's `groups[key]` is
   * oldest-display first (registry recency order within the partition),
   * and the partition's measured total shrinks as real files are deleted
   * front-to-back. Partitions evict INDEPENDENTLY — a search flood can
   * never free space by dropping live covers, and vice versa.
   * Conservative on every axis:
   *
   * - `unknown` stats are skipped — no path was obtainable, the file may
   *   still exist, and a later measure resolves it (heals in or out);
   * - `absent` stats are skipped — nothing to delete, the registry
   *   already owns the pruning of these;
   * - a failed deletion keeps the URL registered (bytes stay counted;
   *   the next pass retries);
   * - each partition's NEWEST entry is never evicted, so the trimmer
   *   can't discard the cover the user is looking at right now — even a
   *   cap smaller than one cover leaves the freshest file standing.
   */
  private async evictPartitions(
    groups: Record<CoverStorageKey, string[]>,
    statByUrl: Map<string, CachedStat>,
    caps: Record<CoverStorageKey, number> | null,
  ): Promise<CoverCacheTrimResult> {
    const evicted: string[] = [];
    let freedBytes = 0;

    if (caps) {
      for (const key of CATEGORY_ORDER) {
        const partition = groups[key];
        let partitionBytes = partition.reduce<number>((sum, url) => {
          const stat = statByUrl.get(url);
          return sum + (stat?.state === "found" ? stat.bytes : 0);
        }, 0);
        const cap = caps[key];
        if (partitionBytes <= cap) continue;

        // Walk the partition's ring up to (but excluding) its newest
        // entry — index 0 is the oldest end of the buffer, the read
        // pointer advances one slot per eviction.
        // NOTE: the awaits are DELIBERATELY sequential. Each deletion
        // decides whether the next one is needed at all (budget-progressive);
        // parallelizing would pre-delete MORE covers than the cap requires.
        // Evictions are per-slot on a FIFO walk, not a batch operation — that
        // is the ring contract, so `for await` (not `Promise.all`).
        for await (const url of partition.slice(0, -1)) {
          if (partitionBytes <= cap) break;
          const stat = statByUrl.get(url);
          if (stat?.state !== "found") continue;
          if (!(await deleteCachedFile(url))) continue;
          evicted.push(url);
          freedBytes += stat.bytes;
          partitionBytes -= stat.bytes;
        }
      }
    }

    const total = [...statByUrl.values()].reduce<number>(
      (sum, stat) => (stat.state === "found" ? sum + stat.bytes : sum),
      0,
    );
    return { evicted, freedBytes, remainingBytes: total - freedBytes };
  }
}

export const coverDiskStorage = new CoverDiskStorage();
