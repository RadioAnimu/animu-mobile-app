import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeCacheStorage } from "@/__tests__/fake-cache-storage";
import { encodeEntry, fileNameOf } from "@/core/lyrics/cache-entry";
import { LyricsFileCache } from "@/core/lyrics/file-cache.web";
import type { CachedLookup } from "@/core/lyrics/ports";
import { WebStore } from "@/utils/web-store";

const entry = (savedAt: number): CachedLookup => ({ savedAt, result: { kind: "none" } });

describe("LyricsFileCache (web)", () => {
  beforeEach(() => {
    installFakeCacheStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads back what it wrote, by song key", async () => {
    const cache = new LyricsFileCache();
    await cache.write("LiSA|Gurenge", entry(1));
    expect(await cache.read("LiSA|Gurenge")).toEqual(entry(1));
    expect(await cache.read("LiSA|Homura")).toBeNull();
  });

  it("trims back to the 400 newest once 450 are kept", async () => {
    let clock = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (clock += 1));
    // The first 449 go straight into the store, oldest first: each of the
    // cache's own writes lists the whole store, too slow to repeat 450 times
    // on a busy CI host. The 450th, through the cache, has to trim.
    const store = new WebStore("lyrics");
    for (let i = 0; i < 449; i += 1) {
      // react-doctor-disable-next-line async-await-in-loop -- writes in order: the oldest are trimmed first.
      await store.write(fileNameOf(`song-${i}`), encodeEntry(`song-${i}`, entry(i)));
    }
    const cache = new LyricsFileCache();
    await cache.write("song-449", entry(449));

    const kept = await Promise.all(Array.from({ length: 450 }, (_, i) => cache.read(`song-${i}`)));
    expect(kept.filter(Boolean)).toHaveLength(400);
    expect(kept.slice(0, 50).every((lookup) => lookup === null)).toBe(true);
    expect(kept[449]).toEqual(entry(449));
  });
});
