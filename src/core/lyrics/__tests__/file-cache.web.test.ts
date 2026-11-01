import { beforeEach, describe, expect, it } from "vitest";
import { installFakeCacheStorage } from "@/__tests__/fake-cache-storage";
import { LyricsFileCache } from "@/core/lyrics/file-cache.web";
import type { CachedLookup } from "@/core/lyrics/ports";

const entry = (savedAt: number): CachedLookup => ({ savedAt, result: { kind: "none" } });

describe("LyricsFileCache (web)", () => {
  beforeEach(() => {
    installFakeCacheStorage();
  });

  it("reads back what it wrote, by song key", async () => {
    const cache = new LyricsFileCache();
    await cache.write("LiSA|Gurenge", entry(1));
    expect(await cache.read("LiSA|Gurenge")).toEqual(entry(1));
    expect(await cache.read("LiSA|Homura")).toBeNull();
  });

  it("trims back to 400 entries once 450 are kept", async () => {
    const cache = new LyricsFileCache();
    for (let i = 0; i < 450; i += 1) {
      // react-doctor-disable-next-line async-await-in-loop -- writes in order: the oldest are trimmed first.
      await cache.write(`song-${i}`, entry(i));
    }
    expect(await cache.read("song-449")).toEqual(entry(449));
    const kept = await Promise.all(Array.from({ length: 450 }, (_, i) => cache.read(`song-${i}`)));
    expect(kept.filter(Boolean)).toHaveLength(400);
  });
});
