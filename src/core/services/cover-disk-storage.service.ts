import { Image } from "expo-image";
import { File } from "expo-file-system";
import { toFileUri } from "@/utils/file-uri";
import {
  coverCacheRegistry,
  type CoverCacheCategory,
} from "@/core/services/cover-cache-registry.service";
import {
  CATEGORY_ORDER,
  resolvePartitionCaps,
  type CoverCachePartitions,
} from "@/core/services/cover-cache-partitions";

/**
 * Grace for a freshly tagged URL whose bytes are still being written to the
 * image cache: pruning it then would lose the tag for good.
 */
const SEED_GRACE_MS = 60_000;

type CoverStorageKey = CoverCacheCategory;

export interface CoverStorageSlice {
  key: CoverStorageKey;
  bytes: number;
  count: number;
}

export interface CoverStorageSnapshot {
  slices: CoverStorageSlice[];
  totalBytes: number;
  totalCount: number;
}

/** Result of one byte-limit pass (`trim`, or the one inside `computeSnapshot`). */
export interface CoverCacheTrimResult {
  /** URLs whose cache files were deleted — oldest displayed first. */
  evicted: string[];
  freedBytes: number;
  remainingBytes: number;
}

/**
 * One tracked URL on disk. `absent` is safe to prune; `unknown` (the stat
 * failed, the file may exist) is kept but counts no bytes.
 */
type CachedStat =
  | { state: "found"; bytes: number }
  | { state: "absent" }
  | { state: "unknown" };

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

/** Deletes the file behind expo-image's cache key: the same lookup the measure stats. */
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
 * Measures cached covers per category from the real files expo-image keeps,
 * pruning URLs whose files are gone. With a byte limit, the same pass deletes
 * the oldest displayed covers until each partition fits.
 */
class CoverDiskStorage {
  /** A wipe is running: every wipe goes through `clearAll`, and its buttons disable on this. */
  private readonly clearListeners = new Set<() => void>();
  private clearing = false;

  /** Snapshots, trims, deletes and wipes run one at a time, so none sees another half done. */
  private workChain: Promise<unknown> = Promise.resolve();

  constructor() {
    coverCacheRegistry.onEvict = (url) => {
      // Re-tagged while queued: displayed again, so the file stays.
      void this.enqueue(async () => {
        if (coverCacheRegistry.taggedAt(url) == null) await deleteCachedFile(url);
      });
    };
  }

  get isClearing(): boolean {
    return this.clearing;
  }

  /** Pub/sub for the `clearing` flag (`useSyncExternalStore`). */
  subscribe(listener: () => void): () => void {
    this.clearListeners.add(listener);
    return () => this.clearListeners.delete(listener);
  }

  private setClearing(next: boolean): void {
    if (this.clearing === next) return;
    this.clearing = next;
    for (const listener of this.clearListeners) listener();
  }

  /** Queues an operation; a failure rejects its caller, never the next operation. */
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

  /** Deletes the oldest covers of each partition over its cap (from `maxBytes` and the overrides). */
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

      // Absent files (the image cache evicted them) and trimmed ones are
      // forgotten in one persist; a freshly tagged URL rides out the grace.
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
          // A URL tagged during this pass was never stat'd: the next one counts it.
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

  /** One stat per tracked URL, keyed by URL. */
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
   * Deletes oldest-first within each partition until it fits its cap.
   * Partitions evict independently (a search flood never drops live covers).
   * Only `found` files are deleted; a failed delete stays registered for the
   * next pass; a partition's newest entry (likely on screen) is never deleted.
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
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- partitions evict one at a time by design; see the sequential note in evictPartition
        const result = await this.evictPartition(
          groups[key],
          caps[key],
          statByUrl,
        );
        evicted.push(...result.evicted);
        freedBytes += result.freedBytes;
      }
    }

    const total = [...statByUrl.values()].reduce<number>(
      (sum, stat) => (stat.state === "found" ? sum + stat.bytes : sum),
      0,
    );
    return { evicted, freedBytes, remainingBytes: total - freedBytes };
  }
  /** One partition's FIFO walk — see {@link evictPartitions} for the contract. */
  private async evictPartition(
    partition: string[],
    cap: number,
    statByUrl: Map<string, CachedStat>,
  ): Promise<{ evicted: string[]; freedBytes: number }> {
    const evicted: string[] = [];
    let freedBytes = 0;
    let partitionBytes = partition.reduce<number>((sum, url) => {
      const stat = statByUrl.get(url);
      return sum + (stat?.state === "found" ? stat.bytes : 0);
    }, 0);
    if (partitionBytes <= cap) return { evicted, freedBytes };

    // Oldest first, never the newest. Sequential on purpose: each delete
    // decides whether the next is needed, so parallel deletes would overshoot.
    for (const url of partition.slice(0, -1)) {
      if (partitionBytes <= cap) break;
      const stat = statByUrl.get(url);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- sequential by contract: each deletion decides whether the next one is needed
      if (stat?.state === "found" && (await deleteCachedFile(url))) {
        evicted.push(url);
        freedBytes += stat.bytes;
        partitionBytes -= stat.bytes;
      }
    }
    return { evicted, freedBytes };
  }
}

export const coverDiskStorage = new CoverDiskStorage();
