import { describe, expect, it, vi } from "vitest";

import {
  coverDiskStorage,
  type CoverStorageSnapshot,
} from "../cover-disk-storage.service";
import { coverCacheRegistry } from "../cover-cache-registry.service";

const getCachePathAsync = vi.fn<(key: string) => Promise<string | null>>();

vi.mock("expo-image", () => ({
  Image: {
    getCachePathAsync: (cacheKey: string) => getCachePathAsync(cacheKey),
    clearDiskCache: vi.fn(async () => {}),
    clearMemoryCache: vi.fn(async () => {}),
  },
}));

let stub: { exists: boolean; size: number };

vi.mock("expo-file-system", () => ({
  File: class {
    exists = stub.exists;
    size = stub.size;
    constructor(public uri: string) {}
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => void store.set(key, value),
      removeItem: async (key: string) => void store.delete(key),
    },
  };
});

const URL_A = "https://cdn/a_medium.jpg";
const URL_B = "https://cdn/b_medium.jpg";
const URL_C = "https://cdn/c_medium.jpg";

async function tag(tagged: [string, "live" | "played"][]) {
  await coverCacheRegistry.clear();
  for (const [url, category] of tagged) coverCacheRegistry.tag(url, category);
  await coverCacheRegistry.load();
  getCachePathAsync.mockClear();
}

describe("CoverDiskStorage", () => {
  it("measures real cached files and prunes positively-absent URLs", async () => {
    await tag([
      [URL_A, "live"],
      [URL_B, "played"],
      [URL_C, "played"],
    ]);
    // A: found, B: cache miss, C: stat throws (unknown — must NOT be pruned)
    getCachePathAsync.mockImplementation(async (key: string) => {
      if (key === URL_A) return "/data/cache/a.jpg";
      if (key === URL_C) throw new Error("boom");
      return null;
    });
    stub = { exists: true, size: 1234 };

    const snap = await coverDiskStorage.computeSnapshot() as CoverStorageSnapshot & { slices: { bytes: number; count: number }[] };

    expect(snap.totalBytes).toBe(1234);
    expect(snap.totalCount).toBe(1);
    expect(snap.slices.find((s) => s.bytes > 0)?.bytes).toBe(1234);

    // Missing-yet-queried: B is positively absent → must be pruned;
    // C threw → must stay registered for the next measure.
    const groups = coverCacheRegistry.groupByCategory();
    expect(groups.live).toContain(URL_A);
    expect(groups.played).toContain(URL_C);
    expect(groups.played.every((u) => u !== URL_B)).toBe(true);
  });

  it("never treats a stat failure as a cache miss (the Android 'URI is not absolute' wipe regression)", async () => {
    await tag([
      [URL_A, "live"],
      [URL_B, "played"],
    ]);
    getCachePathAsync.mockResolvedValue("/data/cache/x.jpg"); // bare path, like Glide's absolutePath
    getCachePathAsync
      .mockImplementationOnce(async () => {
        throw new Error("URI is not absolute");
      })
      .mockImplementationOnce(async () => {
        throw new Error("URI is not absolute");
      });
    stub = { exists: false, size: 0 };

    await coverDiskStorage.computeSnapshot() as CoverStorageSnapshot & { slices: { bytes: number; count: number }[] };

    const groups = coverCacheRegistry.groupByCategory();
    expect(groups.live).toContain(URL_A);
    expect(groups.played).toContain(URL_B);
  });
});
