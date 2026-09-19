import { Image } from "expo-image";
import { artworkSizeRank, deriveArtworkVariants } from "animu-api";

import type { CoverDiskCache } from "@/core/player/cover-ports";

/**
 * Adapters over expo-image's own disk cache, implementing the ports in
 * `cover-ports.ts`. Two bridges, mirrored directions:
 *
 * - {@link CoverCacheSeeder}  — the media-session resolver downloaded a
 *   cover to a local file → register those bytes under the remote URL so
 *   the in-app `Cover` renders from the disk cache instantly (no
 *   duplicate download).
 * - {@link CachedCoverLookup} — the resolver asks "is this cover already
 *   on disk from another journey?" (an in-app display of the same URL, or
 *   a larger sibling derived from the CDN's trackImage naming scheme)
 *   before spending a download of its own.
 *
 * Both are zero-cost best efforts: cache misses, probes and eviction
 * races degrade to the caller's regular download/render path.
 */

/**
 * expo-image's Android impl returns Glide's `file.absolutePath` — a bare
 * path with no scheme. Every consumer of these bridges treats the result
 * as a loadable URI (media-session artwork, expo-file-system `File`),
 * which require an absolute `file://` URI, so normalize here.
 */
function toFileUri(path: string): string {
  return /^file:\/\//.test(path) ? path : `file://${path}`;
}

/** expo-image impl of the disk-cache port. */
export class ExpoImageCoverDiskCache implements CoverDiskCache {
  async getCachePath(cacheKey: string): Promise<string | null> {
    const path = await Image.getCachePathAsync(cacheKey);
    return path ? toFileUri(path) : null;
  }

  writeCache(source: string, cacheKey: string): Promise<void> {
    if (!source.startsWith("file://")) {
      return Promise.resolve();
    }
    return Image.writeToCacheAsync(source, cacheKey);
  }
}

const MIN_RANK: Record<"tiny" | "medium" | "large", number> = {
  tiny: 1,
  medium: 2,
  large: 3,
};

/** Candidate sizes ordered best-first — a cached miniature must never replace the requested resolution. */
const RANK_ORDER: ("large" | "medium" | "tiny")[] = ["large", "medium", "tiny"];

/**
 * Disk-cache hit lookup for the artwork resolver: exact URL first, then
 * sibling URLs derived from the CDN naming scheme whose size is NOT worse
 * than the requested one (a `medium` request happily reuses the cached
 * `large`, never the `tiny`).
 */
export class CachedCoverLookup {
  constructor(private readonly diskCache: CoverDiskCache) {}

  async find(url: string): Promise<string | null> {
    const needed = MIN_RANK[artworkSizeRank(url)];

    const candidates: string[] = [url];
    const siblings = deriveArtworkVariants(url);
    if (siblings) {
      candidates.push(
        ...RANK_ORDER.filter(
          (size) =>
            siblings[size] && MIN_RANK[artworkSizeRank(siblings[size]!)] >= needed,
        ).map((size) => siblings[size] as string),
      );
    }

    for (const candidate of candidates) {
      const path = await this.getCachePath(candidate);
      if (path) return path;
    }
    return null;
  }

  private getCachePath(cacheKey: string): Promise<string | null> {
    return this.diskCache
      .getCachePath(cacheKey)
      .catch((error) => {
        console.warn("[CoverImageCache] cache probe failed:", error);
        return null;
      });
  }
}

/** Best effort — a failed seed only costs one extra download later. */
export class CoverCacheSeeder {
  constructor(private readonly diskCache: CoverDiskCache) {}

  async seed(localUri: string, remoteUrl: string): Promise<void> {
    try {
      if (!localUri?.startsWith?.("file://")) return;
      // Never overwrite an entry that another load already cached. On
      // Android the write goes through Glide's delete-before-write disk
      // cache, so seeding over an entry the in-app `Cover` is displaying or
      // loading can evict the file it is reading and leave the view stuck
      // on the previous artwork.
      const existing = await this.diskCache
        .getCachePath(remoteUrl)
        .catch(() => null);
      if (existing) return;
      await this.diskCache.writeCache(localUri, remoteUrl);
    } catch (error) {
      console.warn("[CoverImageCache] seed failed:", error);
    }
  }
}
