import { beforeEach, describe, expect, it, vi } from "vitest";

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

function freshRegistry() {
  return new CoverCacheRegistry();
}

describe("CoverCacheRegistry", () => {
  beforeEach(() => {
    memory.clear();
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
    await vi.waitFor(() => expect(memory.has("coverCacheRegistry")).toBe(true));

    const reloaded = freshRegistry();
    await reloaded.load();
    expect(reloaded.groupByCategory().requested).toEqual([URLS.requested]);
  });

  it("clear() wipes memory and storage", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.live, "live");
    await vi.waitFor(() => expect(memory.has("coverCacheRegistry")).toBe(true));

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

  it("a burst of same-category re-tags writes at most once (recycling rows don't churn storage)", async () => {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    const setItem = vi.mocked(AsyncStorage.default.setItem as ReturnType<typeof vi.fn>);

    const registry = freshRegistry();
    for (let i = 0; i < 10; i++) {
      registry.tag(URLS.search, "search");
    }
    await vi.waitFor(() => expect(memory.has("coverCacheRegistry")).toBe(true));
    const afterFirstStable = setItem.mock.calls.length;
    expect(afterFirstStable).toBeGreaterThan(0);

    // Same (url, category) re-tag on the SAME instance → no-op, no additional write
    for (let i = 0; i < 5; i++) {
      registry.tag(URLS.search, "search");
    }
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(setItem.mock.calls.length).toBe(afterFirstStable);
  });

  it("tag() keeps the FIFO ring honest: re-tag moves the entry to the tail", () => {
    const registry = freshRegistry();
    // Iteration order is observable through groupByCategory() (oldest first
    // per group) — re-displaying the oldest cover moves it to the ring's tail.
    vi.useFakeTimers();
    try {
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
    } finally {
      vi.useRealTimers();
    }
  });

  it("prune() drops evicted URLs from memory and storage", async () => {
    const registry = freshRegistry();
    registry.tag(URLS.played, "played");
    await vi.waitFor(() => expect(memory.has("coverCacheRegistry")).toBe(true));

    await registry.prune([URLS.played]);
    expect(registry.groupByCategory().played).toEqual([]);

    const reloaded = freshRegistry();
    await reloaded.load();
    expect(reloaded.groupByCategory().played).toEqual([]);
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
      // Every queued persist wrote the FINAL 12-entry map — no stale overwrite
      await vi.waitFor(() => expect(writes.length).toBeGreaterThan(0));
      const last = JSON.parse(writes[writes.length - 1]!) as { entries: Record<string, unknown> };
      expect(Object.keys(last.entries)).toHaveLength(12);
      expect(writes.every((w) => JSON.parse(w).entries["https://cdn/img-11.jpg"])).toBe(true);
    } finally {
      vi.doUnmock("@react-native-async-storage/async-storage");
      memory.clear();
    }
  });
});
