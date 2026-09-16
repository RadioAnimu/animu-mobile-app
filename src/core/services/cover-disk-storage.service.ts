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

function zip(
  urls: string[],
  sizes: (number | null)[],
): [string, number | null][] {
  return urls.map((url, index) => [url, sizes[index] ?? null] as const);
}

/** Disk bytes for one URL via expo-image's own cache-key lookup; null = evicted/absent. */
async function cachedFileBytes(url: string): Promise<number | null> {
  try {
    const path = await Image.getCachePathAsync(url);
    if (!path) return null;
    const file = new File(path);
    return file.exists ? Math.max(file.size, 0) : null;
  } catch (error) {
    console.warn("[CoverDiskStorage] stat failed:", error);
    return null;
  }
}

/**
 * Answers "how much disk do cached covers take" per app category by
 * stat'ing the real files expo-image stores (one lookup per tracked URL,
 * batched). Registry URLs whose files were evicted are pruned so the
 * legend never shows ghosts.
 */
export class CoverDiskStorage {
  async computeSnapshot(): Promise<CoverStorageSnapshot> {
    await coverCacheRegistry.load();

    const groups = coverCacheRegistry.groupByCategory();
    const missing: string[] = [];
    const slices: CoverStorageSlice[] = [];

    for (const key of CATEGORY_ORDER) {
      const sizes = await Promise.all(groups[key].map(cachedFileBytes));
      for (const [url, size] of zip(groups[key], sizes)) {
        if (size == null) missing.push(url);
      }
      slices.push({
        key,
        bytes: sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0),
        count: sizes.filter((size) => size != null).length,
      });
    }

    await coverCacheRegistry.prune(missing);

    return {
      slices,
      totalBytes: slices.reduce((sum, slice) => sum + slice.bytes, 0),
      totalCount: slices.reduce((sum, slice) => sum + slice.count, 0),
    };
  }

  /**
   * Wipe path for the Settings clean button: expo-image's memory + disk
   * caches hold BOTH the in-app covers and (via getCachePathAsync) the
   * files we just measured, so clearing them plus the registry empties
   * every measured slice.
   */
  async clearAll(): Promise<void> {
    await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
    await coverCacheRegistry.clear();
  }
}

export const coverDiskStorage = new CoverDiskStorage();
