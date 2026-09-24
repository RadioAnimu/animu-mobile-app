import { Image } from "expo-image";
import { artworkSizeRank, deriveArtworkVariants } from "animu-api";
import { toFileUri } from "@/utils/file-uri";
import type { CoverDiskCache } from "@/core/player/storage/cover-ports";

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

/**
 * Canonical key for a cover URL.
 *
 * Different endpoints emit the same cover path with inconsistent slashes
 * (`/media/...` vs `//media/...`). Everything keyed by exact URL — the
 * app-side image cache, the resolver's probes — misses across journeys
 * because of it ("ADAMAS" was on screen at `//media` and re-downloaded as
 * `/media` seconds later). Collapse duplicate slashes after the scheme;
 * the CDN serves both identically.
 */
export function normalizeArtworkKey(url: string): string {
  return url.replace(/([^:])\/{2,}/g, "$1/");
}

/** The canonical form and the URL's own spelling (both cache keys). */
export function artworkKeyVariants(url: string): string[] {
  const normalized = normalizeArtworkKey(url);
  return normalized === url ? [url] : [normalized, url];
}

/** Numeric rank per artwork size — one shared table for every size comparison. */
export const ARTWORK_SIZE_RANK: Record<"tiny" | "medium" | "large", number> = {
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
    const needed = ARTWORK_SIZE_RANK[artworkSizeRank(url)];

    const candidates: string[] = [...artworkKeyVariants(url)];
    const siblings = deriveArtworkVariants(url);
    if (siblings) {
      for (const size of RANK_ORDER) {
        if (
          siblings[size] &&
          ARTWORK_SIZE_RANK[artworkSizeRank(siblings[size]!)] >= needed
        ) {
          candidates.push(...artworkKeyVariants(siblings[size] as string));
        }
      }
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
      // Register under BOTH spellings the endpoints emit — the seeded
      // bytes must satisfy whichever journey asks next, not just the one
      // that triggered the download.
      await Promise.all(
        artworkKeyVariants(remoteUrl).map((key) =>
          this.diskCache.writeCache(localUri, key),
        ),
      );
    } catch (error) {
      console.warn("[CoverImageCache] seed failed:", error);
    }
  }
}
