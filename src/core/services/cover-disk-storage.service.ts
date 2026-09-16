import { Image } from "expo-image";
import { File } from "expo-file-system";

import {
  coverCacheRegistry,
  type CoverCacheCategory,
} from "./cover-cache-registry.service";

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

const CATEGORY_ORDER: CoverStorageKey[] = ["live", "requested", "played", "search"];

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
 * Answers "how much disk do cached covers take" per app category by
 * stat'ing the real files expo-image stores (one lookup per tracked URL,
 * batched). Registry URLs whose files were evicted are pruned so the
 * legend never shows ghosts.
 */
export class CoverDiskStorage {
  /** Shared wipe-in-progress flag — the Settings toggle and the storage
      card's clean button both disable themselves while any wipe runs
      (the clean button AND the automatic wipe on cache-off come through
      `clearAll`, so this is the one source of truth). */
  private clearListeners = new Set<() => void>();
  private clearing = false;

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

  async clearAll(): Promise<void> {
    this.setClearing(true);
    try {
      await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
      await coverCacheRegistry.clear();
    } finally {
      this.setClearing(false);
    }
  }

  async computeSnapshot(): Promise<CoverStorageSnapshot> {
    await coverCacheRegistry.load();

    const groups = coverCacheRegistry.groupByCategory();
    const prunable: string[] = [];
    const slices: CoverStorageSlice[] = [];

    for (const key of CATEGORY_ORDER) {
      const group = groups[key];
      const stats = await Promise.all(group.map(cachedFileBytes));
      const missing = group.filter((_, index) => stats[index].state === "absent");
      slices.push({
        key,
        bytes: stats.reduce<number>(
          (sum, stat) => sum + (stat.state === "found" ? stat.bytes : 0),
          0,
        ),
        count: stats.filter((stat) => stat.state === "found").length,
      });
      prunable.push(...missing);
    }

    await coverCacheRegistry.prune(prunable);

    return {
      slices,
      totalBytes: slices.reduce((sum, slice) => sum + slice.bytes, 0),
      totalCount: slices.reduce((sum, slice) => sum + slice.count, 0),
    };
  }
}


export const coverDiskStorage = new CoverDiskStorage();
