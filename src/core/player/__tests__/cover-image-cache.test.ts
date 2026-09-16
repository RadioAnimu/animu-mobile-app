import { describe, expect, it, vi } from "vitest";

import {
  CachedCoverLookup,
  CoverCacheSeeder,
} from "../cover-image-cache";
import type { CoverDiskCache } from "../cover-ports";

// expo-image reaches the expo package (unparseable in node) — mocked at
// hoist time (vitest hoists vi.mock above the imports); the adapters are
// exercised through the `CoverDiskCache` port fakes below.
vi.mock("expo-image", () => ({ Image: {} }));

/** In-memory fake of the disk-image cache — exact test surface, no native modules. */
class FakeDiskCache implements CoverDiskCache {
  disk = new Map<string, string>();

  async getCachePath(cacheKey: string): Promise<string | null> {
    return this.disk.get(cacheKey) ?? null;
  }

  async writeCache(source: string, cacheKey: string): Promise<void> {
    this.disk.set(cacheKey, source);
  }
}

const URL_MEDIUM = "https://cdn/trackImage10_medium.jpg";

describe("CachedCoverLookup", () => {
  it("hits the exact URL first (perfect journey match)", async () => {
    const disk = new FakeDiskCache();
    disk.disk.set(URL_MEDIUM, "file://image-cache/medium.jpg");

    expect(await new CachedCoverLookup(disk).find(URL_MEDIUM)).toBe(
      "file://image-cache/medium.jpg",
    );
  });

  it("a cached larger sibling stands in for a smaller request (large covers medium)", async () => {
    const disk = new FakeDiskCache();
    disk.disk.set(
      "https://cdn/trackImage10_large.jpg",
      "file://image-cache/large.jpg",
    );

    expect(await new CachedCoverLookup(disk).find(URL_MEDIUM)).toBe(
      "file://image-cache/large.jpg",
    );
  });

  it("a cached smaller sibling NEVER replaces the requested resolution (medium request, tiny cached)", async () => {
    const disk = new FakeDiskCache();
    disk.disk.set("https://cdn/trackImage10_tiny.jpg", "file://image-cache/tiny.jpg");

    expect(await new CachedCoverLookup(disk).find(URL_MEDIUM)).toBeNull();
  });

  it("prefers the exact URL when both exact and larger sibling are cached", async () => {
    const disk = new FakeDiskCache();
    disk.disk.set(URL_MEDIUM, "file://image-cache/medium.jpg");
    disk.disk.set("https://cdn/trackImage10_large.jpg", "file://image-cache/large.jpg");

    expect(await new CachedCoverLookup(disk).find(URL_MEDIUM)).toBe(
      "file://image-cache/medium.jpg",
    );
  });

  it("returns null when nothing was cached (regular download path resumes)", async () => {
    expect(await new CachedCoverLookup(new FakeDiskCache()).find(URL_MEDIUM)).toBeNull();
  });

  it("outside the trackImage scheme, only the exact URL is probed (no fake siblings)", async () => {
    const disk = new FakeDiskCache();
    disk.disk.set("https://cdn/other/trackImage10_large.jpg", "file://image-cache/fire.jpg");
    // deriveArtworkVariants cannot rewrite "cover.jpg" — no sibling probing
    expect(await new CachedCoverLookup(disk).find("https://cdn/cover.jpg")).toBeNull();

    disk.disk.set("https://cdn/cover.jpg", "file://image-cache/right.jpg");
    expect(await new CachedCoverLookup(disk).find("https://cdn/cover.jpg")).toBe(
      "file://image-cache/right.jpg",
    );
  });

  it("a failing probe degrades to null without throwing", async () => {
    class FailingDisk implements CoverDiskCache {
      async getCachePath(): Promise<string | null> {
        throw new Error("native exploded");
      }
      async writeCache(): Promise<void> {}
    }
    expect(await new CachedCoverLookup(new FailingDisk()).find(URL_MEDIUM)).toBeNull();
  });
});

describe("CoverCacheSeeder", () => {
  it("registers a downloaded file under its original remote URL", async () => {
    const disk = new FakeDiskCache();
    await new CoverCacheSeeder(disk).seed(
      "file://image-cache/cover.png",
      URL_MEDIUM,
    );
    expect(disk.disk.get(URL_MEDIUM)).toBe("file://image-cache/cover.png");
  });

  it("never seeds with a non-file URI (download degraded to the remote URL)", async () => {
    const disk = new FakeDiskCache();
    await new CoverCacheSeeder(disk).seed("https://cdn/remote.jpg", URL_MEDIUM);
    expect(disk.disk.size).toBe(0);
  });

  it("a write failure is swallowed (seed is best effort)", async () => {
    class ThrowingDisk implements CoverDiskCache {
      async getCachePath(): Promise<string | null> {
        return null;
      }
      async writeCache(): Promise<void> {
        throw new Error("disk full");
      }
    }
    await expect(
      new CoverCacheSeeder(new ThrowingDisk()).seed("file://x", URL_MEDIUM),
    ).resolves.toBeUndefined();
  });
});
