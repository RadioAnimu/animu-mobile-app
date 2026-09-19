import { describe, expect, it, vi } from "vitest";

import {
  coverDiskStorage,
  type CoverCacheTrimResult,
} from "@/core/services/cover-disk-storage.service";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";

const { getCachePathAsync, files, failDeleteUris } = vi.hoisted(() => {
  const getCachePathAsync = vi.fn<(key: string) => Promise<string | null>>();
  const files = new Map<string, { exists: boolean; size: number }>();
  const failDeleteUris = new Set<string>();
  return { getCachePathAsync, files, failDeleteUris };
});

vi.mock("expo-image", () => ({
  Image: {
    getCachePathAsync: (cacheKey: string) => getCachePathAsync(cacheKey),
    clearDiskCache: vi.fn(async () => {}),
    clearMemoryCache: vi.fn(async () => {}),
  },
}));

vi.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    exists: boolean;
    size: number;
    constructor(uri: string) {
      this.uri = uri;
      this.exists = files.get(uri)?.exists ?? false;
      this.size = files.get(uri)?.size ?? 0;
    }
    delete(): void {
      if (failDeleteUris.has(this.uri)) throw new Error("device error");
      if (!this.exists) throw new Error("no such file");
      this.exists = false;
      files.set(this.uri, { exists: false, size: 0 });
    }
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

const LIVE1 = "https://cdn/live-medium.jpg";
const FLOOD1 = "https://cdn/flood-1_medium.jpg";
const FLOOD2 = "https://cdn/flood-2_medium.jpg";
const FLOOD3 = "https://cdn/flood-3_medium.jpg";
const PLAYED1 = "https://cdn/played-1_medium.jpg";
const PLAYED2 = "https://cdn/played-2_medium.jpg";

type Category = "live" | "played" | "search";

function uriFor(url: string): string {
  return `file:///data/cache/${encodeURIComponent(url)}`;
}

function fileFor(url: string): { exists: boolean; size: number } {
  const entry = files.get(uriFor(url));
  if (!entry) throw new Error(`missing mock entry for ${url}`);
  return entry;
}

/** Fresh registry + disk mocks per test: auto-derive distinct files. */
async function setup(
  tagged: [string, Category][],
  sizes: Record<string, number> = {},
  options: { brokenKeys?: string[] } = {},
) {
  await coverCacheRegistry.clear();
  files.clear();
  failDeleteUris.clear();
  for (const [url, category] of tagged) coverCacheRegistry.tag(url, category);
  await coverCacheRegistry.load();

  getCachePathAsync.mockImplementation(async (key: string) => {
    if (options.brokenKeys?.includes(key)) throw new Error("boom");
    return sizes[key] == null
      ? null
      : `/data/cache/${encodeURIComponent(key)}`;
  });
  for (const [url, size] of Object.entries(sizes)) {
    if (size == null) continue;
    files.set(uriFor(url), { exists: true, size });
  }
  getCachePathAsync.mockClear();
}

describe("CoverDiskStorage", () => {
  it("measures real cached files and prunes positively-absent URLs", async () => {
    await setup(
      [
        [LIVE1, "live"],
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [LIVE1]: 1234 },
      { brokenKeys: [PLAYED2] },
    );
    // PLAYED2: stat throws (unknown — must NOT be pruned)

    const snap = await coverDiskStorage.computeSnapshot();

    expect(snap.totalBytes).toBe(1234);
    expect(snap.totalCount).toBe(1);
    expect(snap.slices.find((s) => s.bytes > 0)?.bytes).toBe(1234);

    const groups = coverCacheRegistry.groupByCategory();
    expect(groups.live).toContain(LIVE1);
    expect(groups.played).toContain(PLAYED2); // unknown → kept for healing
  });

  it("never treats a stat failure as a cache miss (the Android 'URI is not absolute' wipe regression)", async () => {
    await setup([
      [LIVE1, "live"],
      [PLAYED1, "played"],
    ]);
    getCachePathAsync.mockResolvedValue("/data/cache/x.jpg"); // bare path, like Glide's absolutePath
    getCachePathAsync
      .mockImplementationOnce(async () => {
        throw new Error("URI is not absolute");
      })
      .mockImplementationOnce(async () => {
        throw new Error("URI is not absolute");
      });

    await coverDiskStorage.computeSnapshot();

    const groups = coverCacheRegistry.groupByCategory();
    expect(groups.live).toContain(LIVE1);
    expect(groups.played).toContain(PLAYED1);
  });

  it("trim(): no limit or under budget runs hands-off", async () => {
    await setup(
      [
        [LIVE1, "live"],
        [PLAYED1, "played"],
      ],
      { [LIVE1]: 500, [PLAYED1]: 300 },
    );

    expect(await coverDiskStorage.trim(0)).toBeNull();

    const result = await coverDiskStorage.trim(801);
    expect(result).toEqual({
      evicted: [],
      freedBytes: 0,
      remainingBytes: 800,
    } satisfies CoverCacheTrimResult);
    expect(fileFor(LIVE1).exists).toBe(true);
    expect(coverCacheRegistry.groupByCategory().live).toContain(LIVE1);
  });

  it("partitions evict independently: a search flood never touches the live cover", async () => {
    await setup(
      [
        [FLOOD1, "search"], // flood = request search, oldest overall
        [FLOOD2, "search"],
        [FLOOD3, "search"], // flood's newest — protected
        [LIVE1, "live"], // 30 B only, but the limit squeeze would love it
      ],
      {
        [FLOOD1]: 600,
        [FLOOD2]: 500,
        [FLOOD3]: 400,
        [LIVE1]: 30,
      },
    );

    // 1 000 total: search partition = 300, live = 300.
    const result = await coverDiskStorage.trim(1000);

    // search: 1500 → evict FLOOD1 → 900 → evict FLOOD2 → 400 (> 300, but
    // FLOOD3 is the partition's newest and protected → stop there).
    expect(result).toEqual({
      evicted: [FLOOD1, FLOOD2],
      freedBytes: 1100,
      remainingBytes: 430,
    } satisfies CoverCacheTrimResult);
    expect(fileFor(LIVE1).exists).toBe(true);
    expect(coverCacheRegistry.groupByCategory().live).toEqual([LIVE1]);
    expect(coverCacheRegistry.groupByCategory().search).toEqual([FLOOD3]);
  });

  it("each partition keeps its own newest entry, even when the cap is impossible", async () => {
    await setup(
      [
        [LIVE1, "live"],
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [LIVE1]: 900, [PLAYED1]: 500, [PLAYED2]: 300 },
    );

    const result = await coverDiskStorage.trim(1200);

    // caps: live 360 / played 300. played (800 → evict PLAYED1 → 300 ≤
    // cap ✓). live: 900 over its 360 cap, but LIVE1 is the partition's
    // only entry (its own newest) → protected, over-cap until the user
    // views another live cover.
    expect(result!.evicted).toEqual([PLAYED1]);
    expect(result!.remainingBytes).toBe(1200);
    expect(fileFor(LIVE1).exists).toBe(true);
    expect(fileFor(PLAYED2).exists).toBe(true);
  });

  it("a full partition trims down to its cap, not to the global limit", async () => {
    await setup(
      [
        [FLOOD1, "search"],
        [FLOOD2, "search"],
        [FLOOD3, "search"],
      ],
      { [FLOOD1]: 200, [FLOOD2]: 200, [FLOOD3]: 200 },
    );

    // 3 000 total → search cap = Math.round(3000 * 0.3) = 900; all 600
    // under → hands-off.
    const under = await coverDiskStorage.trim(3000);
    expect(under!.evicted).toEqual([]);

    // 1 500 total → search cap = 450 → evict the oldest → 400 ≤ 450 ✓.
    const over = await coverDiskStorage.trim(1500);
    expect(over!.evicted).toEqual([FLOOD1]);
    expect(over!.remainingBytes).toBe(400);
  });

  it("custom partitions take their bytes off the top; the rest share what's left proportionally", async () => {
    await setup(
      [
        [FLOOD1, "search"], // oldest overall
        [FLOOD2, "search"],
        [LIVE1, "live"],
        [PLAYED1, "played"],
      ],
      {
        [FLOOD1]: 500,
        [FLOOD2]: 400,
        [LIVE1]: 218,
        [PLAYED1]: 182,
      },
    );

    // Total 1 000 with only search customized to 600: leftover 400 splits
    // by live .3 / played .25 / requested .15 → live 218, played 182,
    // requested 109. search (900) evicts its oldest → 400 ≤ 600.
    const result = await coverDiskStorage.trim(1000, { search: 600 });

    expect(result!.evicted).toEqual([FLOOD1]);
    // live + played fit inside their computed shares exactly.
    expect(fileFor(LIVE1).exists).toBe(true);
    expect(fileFor(PLAYED1).exists).toBe(true);
    expect(result!.remainingBytes).toBe(800);
  });

  it("a customized EMPTY partition wipes out, keeping only its newest entry", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
        [LIVE1, "live"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300, [LIVE1]: 100 },
    );

    const result = await coverDiskStorage.trim(1000, { played: 0 });

    // played cap 0 → evict PLAYED1 (oldest) → PLAYED2 newest → stands.
    expect(result!.evicted).toEqual([PLAYED1]);
    expect(coverCacheRegistry.groupByCategory().played).toEqual([PLAYED2]);
    expect(coverCacheRegistry.groupByCategory().live).toEqual([LIVE1]);
  });

  it("unknown stats stall their partition; a later measure that resolves them trims them out", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [PLAYED2]: 300 },
      { brokenKeys: [PLAYED1] },
    );

    // Pass 1: PLAYED1 unknown → played partition measured at 300 (its
    // cap with limit 800: Math.round(800 * .25) = 200 — 300 over, but
    // PLAYED2 is the partition's newest → protected → hands-off).
    const first = await coverDiskStorage.trim(2000);
    expect(first!.evicted).toEqual([]);

    // Heal-in: PLAYED1 resolves to a huge file (cap at limit 2000 = 500).
    getCachePathAsync.mockImplementation(async (key: string) =>
      key === PLAYED1 || key === PLAYED2
        ? `/data/cache/${encodeURIComponent(key)}`
        : null,
    );
    files.set(uriFor(PLAYED1), { exists: true, size: 900 });
    const second = await coverDiskStorage.trim(2000);
    expect(second).toEqual({
      evicted: [PLAYED1],
      freedBytes: 900,
      remainingBytes: 300,
    } satisfies CoverCacheTrimResult);
    expect(fileFor(PLAYED1).exists).toBe(false);
    expect(fileFor(PLAYED2).exists).toBe(true);
  });

  it("a failed deletion keeps the URL, its bytes, and retries on the next pass", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300 },
    );
    failDeleteUris.add(uriFor(PLAYED1));

    // Cap 300 at limit 2000: 800 over → PLAYED1's delete throws, PLAYED2
    // protected → nothing moves, bytes stay counted.
    const result = await coverDiskStorage.trim(2000);
    expect(result).toEqual({
      evicted: [],
      freedBytes: 0,
      remainingBytes: 800,
    } satisfies CoverCacheTrimResult);
    expect(fileFor(PLAYED1).exists).toBe(true);

    // Heal-out: the failure resolves → next pass frees the partition.
    failDeleteUris.delete(uriFor(PLAYED1));
    const second = await coverDiskStorage.trim(2000);
    expect(second!.evicted).toEqual([PLAYED1]);
    expect(second!.freedBytes).toBe(500);
    expect(fileFor(PLAYED1).exists).toBe(false);
  });

  it("concurrent trim passes serialize — no double eviction, no double freeing", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300 },
    );

    const [r1, r2] = await Promise.all([
      coverDiskStorage.trim(2000),
      coverDiskStorage.trim(2000),
    ]);

    // First pass frees the over-cap partition once; the second finds it
    // already under budget — every URL evicted exactly once, no double
    // accounting.
    expect([...r1!.evicted, ...r2!.evicted].filter((u) => u === PLAYED1)).toHaveLength(1);
    expect(r2!.evicted).toEqual([]);
    expect(r2!.freedBytes).toBe(0);
    expect(r2!.remainingBytes).toBe(300);
  });

  it("tags bursting into an in-flight trim never lose writes and never crash the chain", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300, [LIVE1]: 100 },
    );

    // A tag lands WHILE the trims are queued and mid-flight. Tags and
    // trims run on separate chains (registry persist chain vs storage
    // work chain) on purpose — the invariants below must hold for every
    // interleaving: exactly one physical file deletion, no lost tag,
    // no chain crash.
    const [t1, , t2] = await Promise.all([
      coverDiskStorage.trim(2000),
      Promise.resolve().then(() => coverCacheRegistry.tag(LIVE1, "live")),
      coverDiskStorage.trim(2000),
    ]);

    // First pass frees the partition once; the second finds it under
    // budget — PLAYED1 physically deleted exactly once.
    expect(t1!.evicted).toEqual([PLAYED1]);
    expect(t2!.evicted).toEqual([]);
    expect(fileFor(PLAYED1).exists).toBe(false);
    expect(fileFor(PLAYED2).exists).toBe(true);
    // Racing tags survive untouched.
    expect(coverCacheRegistry.groupByCategory().live).toContain(LIVE1);
    expect(coverCacheRegistry.groupByCategory().played).toEqual([PLAYED2]);

    // A follow-up snapshot measures the world without throwing.
    const snap = await coverDiskStorage.computeSnapshot(0);
    expect(snap.slices.find((s) => s.key === "live")?.bytes).toBeGreaterThan(0);
  });

  it("a wipe queued behind an in-flight trim waits for it and still owns the final state", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300 },
    );

    const [trim] = await Promise.all([
      coverDiskStorage.trim(2000),
      Promise.resolve(),
      coverDiskStorage.clearAll(),
    ]);

    // Trim ran to completion (its own accounting is internally true)…
    expect(trim!.evicted.length).toBeGreaterThan(0);
    // …and the wipe, strictly after it, owned the empty final state.
    expect(coverCacheRegistry.groupByCategory().played).toEqual([]);
    expect(coverDiskStorage.isClearing).toBe(false);
  });

  it("pathological overrides (sum above the user's total) degrade to sums the un-customized singles can live with", async () => {
    await setup(
      [
        [LIVE1, "live"],
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [LIVE1]: 100, [PLAYED1]: 500, [PLAYED2]: 300 },
    );

    // Search huge: leftover for un-customized = 0 → live 0, played 0, but
    // every partition's NEWEST entry still stands (PLAYED2, LIVE1).
    const result = await coverDiskStorage.trim(1000, { search: 999 });

    expect(result!.evicted).toEqual([PLAYED1]);
    expect(fileFor(LIVE1).exists).toBe(true);
    expect(fileFor(PLAYED2).exists).toBe(true);
    expect(coverCacheRegistry.groupByCategory().played).toEqual([PLAYED2]);
  });

  it("raising the limit runs hands-off: no pass disturbs the cache", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300 },
    );

    // Both passes way over budget → evicted empty, bytes untouched.
    const low = await coverDiskStorage.trim(8000);
    expect(low!.evicted).toEqual([]);
    const high = await coverDiskStorage.trim(80000);
    expect(high!.evicted).toEqual([]);
    expect(fileFor(PLAYED1).exists).toBe(true);
    expect(fileFor(PLAYED2).exists).toBe(true);
  });

  it("computeSnapshot(limit) trims inline and reports the post-trim state", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
        [LIVE1, "live"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300, [LIVE1]: 100 },
    );

    const snap = await coverDiskStorage.computeSnapshot(2000);

    expect(snap.totalBytes).toBe(400); // played trimmed to its newest file
    expect(snap.totalCount).toBe(2);
    const played = snap.slices.find((s) => s.key === "played");
    expect(played?.bytes).toBe(300);
    const live = snap.slices.find((s) => s.key === "live");
    expect(live?.bytes).toBe(100);
    expect(coverCacheRegistry.groupByCategory().played).toEqual([PLAYED2]);
  });

  it("eviction during snapshot never resurrects ghosts, and a re-tag heals the URL back for the next pass", async () => {
    await setup(
      [
        [PLAYED1, "played"],
        [PLAYED2, "played"],
        [LIVE1, "live"],
      ],
      { [PLAYED1]: 500, [PLAYED2]: 300, [LIVE1]: 100 },
    );
    await coverDiskStorage.computeSnapshot(2000);
    expect(coverCacheRegistry.groupByCategory().played).toEqual([PLAYED2]);

    // The Cover still on screen re-tags (react display path) and the
    // resolver re-seeds the file — fully self-healing round trip.
    coverCacheRegistry.tag(PLAYED1, "played");
    files.set(uriFor(PLAYED1), { exists: true, size: 500 });
    await coverCacheRegistry.load();

    const groups = coverCacheRegistry.groupByCategory();
    expect(groups.played).toContain(PLAYED1);
    const postTrim = await coverDiskStorage.computeSnapshot(0);
    // The re-seeded file is tracked again and re-counted in full.
    expect(postTrim.totalBytes).toBe(900);
    expect(postTrim.totalCount).toBe(3);
  });

  it("wipes still work after the chain refactor: clearAll owns the flags and the card's clean path stays serialized", async () => {
    await setup(
      [
        [LIVE1, "live"],
        [PLAYED1, "played"],
      ],
      { [LIVE1]: 500, [PLAYED1]: 300 },
    );

    await coverDiskStorage.clearAll();
    expect(coverDiskStorage.isClearing).toBe(false);
    expect(coverCacheRegistry.groupByCategory().live).toEqual([]);
    expect((await coverDiskStorage.trim(1))!.remainingBytes).toBe(0);
  });
});
