import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CoverCacheRegistry,
  type CoverCacheCategory,
} from "@/core/services/cover-cache-registry.service";

const memory = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      memory.delete(key);
    }),
  },
}));

const URLS = {
  live: "https://cdn.animu.studio/live/cover-large.jpg",
  requested: "https://cdn.animu.studio/history/requested.jpg",
  played: "https://cdn.animu.studio/history/played.jpg",
  search: "https://cdn.animu.studio/search/cover.jpg",
};

/** Longer than the registry's persist debounce (1s). */
const PAST_DEBOUNCE_MS = 2_000;

const setItemMock = (): ReturnType<typeof vi.fn> =>
  vi.mocked(AsyncStorage.setItem as ReturnType<typeof vi.fn>);

function freshRegistry() {
  return new CoverCacheRegistry();
}

describe("CoverCacheRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    memory.clear();
    setItemMock().mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups URLs by the category that displayed them", () => {
    const registry = freshRegistry();
    registry.tag(URLS.live, "live");
    registry.tag(URLS.search, "search");
    registry.tag(URLS.played, "played");

    const groups = registry.groupByCategory();
    expect(groups.live).toEqual([URLS.live]);
    expect(groups.search).toEqual([URLS.search]);
    expect(groups.played).toEqual([URLS.played]);
    expect(groups.requested).toEqual([]);
  });

  it("a URL keeps the category of its most recent display", () => {
    const registry = freshRegistry();
    registry.tag(URLS.live, "search");
    registry.tag(URLS.live, "live");

    const groups = registry.groupByCategory();
    expect(groups.live).toEqual([URLS.live]);
    expect(groups.search).toEqual([]);
  });

  it("ignores non-remote URLs (bundled/require assets)", () => {
    const registry = freshRegistry();
    registry.tag("file:///cache/default.png", "live");
    registry.tag("", "live");
    expect(registry.groupByCategory().live).toEqual([]);
  });

  it("persists entries and reloads them into a fresh instance", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.requested, "requested");
    // Nothing hits storage before the debounce elapses.
    expect(memory.has("coverCacheRegistry")).toBe(false);
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(memory.has("coverCacheRegistry")).toBe(true);

    const reloaded = freshRegistry();
    await reloaded.load();
    expect(reloaded.groupByCategory().requested).toEqual([URLS.requested]);
  });

  it("coalesces a burst of tags into a single write", async () => {
    const registry = freshRegistry();
    for (let i = 0; i < 30; i++) {
      registry.tag(`https://cdn.animu.studio/history/${i}.jpg`, "played");
    }
    expect(setItemMock()).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);

    expect(setItemMock()).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(memory.get("coverCacheRegistry")!) as {
      entries: Record<string, unknown>;
    };
    expect(Object.keys(saved.entries)).toHaveLength(30);
  });

  it("clear() wipes memory and storage", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.live, "live");
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(memory.has("coverCacheRegistry")).toBe(true);

    await registry.clear();
    expect(memory.has("coverCacheRegistry")).toBe(false);

    const reloaded = freshRegistry();
    await reloaded.load();
    expect(reloaded.groupByCategory()).toEqual({
      live: [],
      requested: [],
      played: [],
      search: [],
    } satisfies Record<CoverCacheCategory, string[]>);
  });

  it("clear() cancels a pending debounced write so nothing revives the wipe", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.live, "live"); // debounce pending, nothing written yet

    await registry.clear();
    expect(memory.has("coverCacheRegistry")).toBe(false);

    // The cancelled timer must not write the pre-wipe map later.
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(memory.has("coverCacheRegistry")).toBe(false);
    expect(registry.groupByCategory().live).toEqual([]);
  });

  it("a burst of same-category re-tags writes at most once (recycling rows don't churn storage)", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.search, "search");
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    const afterFirstStable = setItemMock().mock.calls.length;
    expect(afterFirstStable).toBe(1);

    // Same (url, category) re-tag on the SAME instance → no-op, no additional write
    for (let i = 0; i < 5; i++) {
      registry.tag(URLS.search, "search");
    }
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(setItemMock().mock.calls).toHaveLength(afterFirstStable);
  });

  it("tag() keeps the FIFO ring honest: re-tag moves the entry to the tail", () => {
    const registry = freshRegistry();
    // Iteration order is observable through groupByCategory() (oldest first
    // per group) — re-displaying the oldest cover moves it to the ring's tail.
    registry.tag(URLS.live, "live");
    registry.tag(URLS.search, "search");
    registry.tag(URLS.played, "played");
    expect(registry.groupByCategory().live).toEqual([URLS.live]);

    // Same (url, category) re-tag, a moment later: fresh recency timestamp.
    vi.advanceTimersByTime(1000);
    registry.tag(URLS.live, "live");
    expect(registry.groupByCategory().live).toEqual([URLS.live]);
    expect(registry.taggedAt(URLS.live)).toBeGreaterThan(
      registry.taggedAt(URLS.search)!,
    );
  });

  it("prune() drops evicted URLs from memory and storage", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.played, "played");
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
    expect(memory.has("coverCacheRegistry")).toBe(true);

    await registry.prune([URLS.played]);
    expect(registry.groupByCategory().played).toEqual([]);

    const reloaded = freshRegistry();
    await reloaded.load();
    expect(reloaded.groupByCategory().played).toEqual([]);
  });

  it("prune() flushes immediately instead of waiting for the debounce", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.played, "played");
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);

    registry.tag(URLS.live, "live"); // debounce pending
    await registry.prune([URLS.played]);

    // The prune write already carries both the removal and the pending tag.
    const saved = JSON.parse(memory.get("coverCacheRegistry")!) as {
      entries: Record<string, { category: string }>;
    };
    expect(Object.keys(saved.entries)).toEqual([URLS.live]);
    expect(saved.entries[URLS.live].category).toBe("live");
  });

  it("burst tags serialize — the final write always carries the newest snapshot", async () => {
    // Delayed writes mimic the real AsyncStorage/task interleaving: a
    // non-serialized implementation would let an older snapshot overwrite
    // a newer one (classic write-stale-race).
    const writes: string[] = [];
    const delay = <T,>(value: T): Promise<T> =>
      new Promise((resolve) => {
        setTimeout(() => resolve(value), 5);
      });
    memory.clear();
    vi.resetModules();
    vi.doMock("@react-native-async-storage/async-storage", () => ({
      default: {
        getItem: async (key: string) => memory.get(key) ?? null,
        setItem: vi.fn(async (key: string, value: string) => {
          await delay(value);
          memory.set(key, value);
          writes.push(value);
        }),
        removeItem: async (key: string) => {
          memory.delete(key);
        },
      },
    }));

    try {
      const { CoverCacheRegistry: Fresh } = await import(
        "@/core/services/cover-cache-registry.service"
      );
      const registry = new Fresh();
      for (let i = 0; i < 12; i++) {
        registry.tag(`https://cdn/img-${i}.jpg`, "search");
      }
      // One coalesced write, carrying the FINAL 12-entry map.
      await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS);
      expect(writes.length).toBeGreaterThan(0);
      const last = JSON.parse(writes[writes.length - 1]!) as { entries: Record<string, unknown> };
      expect(Object.keys(last.entries)).toHaveLength(12);
      expect(writes.every((w) => JSON.parse(w).entries["https://cdn/img-11.jpg"])).toBe(true);
    } finally {
      vi.doUnmock("@react-native-async-storage/async-storage");
      memory.clear();
    }
  });
});
