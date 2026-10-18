import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  byFrecency,
  MAX_HISTORY,
  recentSearchesService,
} from "@/core/services/recent-searches.service";

const STORAGE_KEY = "recentSearches";
/** A fixed "now" so `searchedAt` is asserted, not merely type-checked. */
const NOW = 1_700_000_000_000;

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

/** The stored shape, for terser expectations. */
const entry = (
  query: string,
  total: number | null,
  searchedAt: number,
  uses = 1,
) => ({ query, total, searchedAt, uses });

describe("recentSearchesService", () => {
  beforeEach(() => {
    memory.clear();
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an empty list before anything is stored", async () => {
    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("keeps the newest search first, with its result count", async () => {
    await recentSearchesService.add("one", 12);
    vi.setSystemTime(NOW + 1000);
    await recentSearchesService.add("two", 3);

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("two", 3, NOW + 1000),
      entry("one", 12, NOW),
    ]);
  });

  it("stores the query trimmed", async () => {
    await recentSearchesService.add("  naruto  ", 5);

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("naruto", 5, NOW),
    ]);
  });

  it("de-duplicates ignoring case and accents, keeping the newest casing", async () => {
    await recentSearchesService.add("naruto", 5);
    await recentSearchesService.add("Ação", 2);
    await recentSearchesService.add("NARUTO", 7);
    await recentSearchesService.add("acao", 4);

    const all = await recentSearchesService.getAll();

    expect(all.map((item) => item.query)).toEqual(["acao", "NARUTO"]);
    expect(all.map((item) => item.total)).toEqual([4, 7]);
  });

  it("caps the history at a hundred entries, dropping the oldest", async () => {
    for (let index = 0; index <= MAX_HISTORY; index += 1) {
      await recentSearchesService.add(`q${index}`, 1);
    }

    const all = await recentSearchesService.getAll();

    expect(all).toHaveLength(MAX_HISTORY);
    expect(all[0].query).toBe(`q${MAX_HISTORY}`);
    expect(all.at(-1)?.query).toBe("q1");
  });

  it("counts repeat searches", async () => {
    await recentSearchesService.add("naruto", 5);
    await recentSearchesService.add("bleach", 2);
    await recentSearchesService.add("Naruto", 6);

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("Naruto", 6, NOW, 2),
      entry("bleach", 2, NOW),
    ]);
  });

  it("restores removed entries in time order, newer searches winning", async () => {
    await recentSearchesService.add("old", 1);
    vi.setSystemTime(NOW + 1000);
    await recentSearchesService.add("mid", 2);
    const saved = await recentSearchesService.getAll();
    await recentSearchesService.clear();
    vi.setSystemTime(NOW + 2000);
    // Searched again between the clear and the undo.
    await recentSearchesService.add("MID", 9);

    await expect(recentSearchesService.restore(saved)).resolves.toEqual([
      entry("MID", 9, NOW + 2000),
      entry("old", 1, NOW),
    ]);
  });

  it("drops a stale search (total <= 0) instead of remembering it", async () => {
    await expect(recentSearchesService.add("bleach", 0)).resolves.toEqual([]);

    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("drops an older entry that the empty search makes stale, whatever its casing", async () => {
    await recentSearchesService.add("Ação", 5);

    await expect(recentSearchesService.add("  acao ", -1)).resolves.toEqual([]);
    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("ignores an empty query", async () => {
    await recentSearchesService.add("one", 1);

    await expect(recentSearchesService.add("   ", 9)).resolves.toEqual([
      entry("one", 1, NOW),
    ]);
  });

  it("removes a query matched the same loose way", async () => {
    await recentSearchesService.add("Naruto", 5);
    await recentSearchesService.add("Bleach", 2);

    await expect(recentSearchesService.remove("naruto")).resolves.toEqual([
      entry("Bleach", 2, NOW),
    ]);
    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("Bleach", 2, NOW),
    ]);
  });

  it("migrates the legacy string list with unknown count and time", async () => {
    memory.set(STORAGE_KEY, JSON.stringify(["one", "two"]));

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("one", null, 0),
      entry("two", null, 0),
    ]);
  });

  it("drops malformed items and keeps the readable ones", async () => {
    memory.set(
      STORAGE_KEY,
      JSON.stringify([
        "ok",
        42,
        null,
        { query: 5 },
        { query: "   " },
        { query: "kept", total: "many", searchedAt: "later" },
        { query: "timed", total: 3, searchedAt: NOW },
      ]),
    );

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("ok", null, 0),
      entry("kept", null, 0),
      entry("timed", 3, NOW),
    ]);
  });

  it("discards a corrupt stored value", async () => {
    memory.set(STORAGE_KEY, "{not json");

    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("discards a stored value that is not a list", async () => {
    memory.set(STORAGE_KEY, JSON.stringify({ query: "naruto" }));

    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("clears every stored search", async () => {
    await recentSearchesService.add("one", 1);
    await recentSearchesService.clear();

    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("applies overlapping mutations in call order", async () => {
    await recentSearchesService.add("bleach", 3);
    // Fired without awaiting, as the screen does: each must see the last.
    const added = recentSearchesService.add("naruto", 5);
    const removed = recentSearchesService.remove("bleach");

    await expect(added).resolves.toEqual([
      entry("naruto", 5, NOW),
      entry("bleach", 3, NOW),
    ]);
    await expect(removed).resolves.toEqual([entry("naruto", 5, NOW)]);
    await expect(recentSearchesService.getAll()).resolves.toEqual([
      entry("naruto", 5, NOW),
    ]);
  });

  it("keeps working when storage refuses to save", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(
      new Error("disk full"),
    );

    await expect(recentSearchesService.add("naruto", 5)).resolves.toEqual([
      entry("naruto", 5, NOW),
    ]);
    expect(warn).toHaveBeenCalledWith(
      "[RecentSearches] save failed:",
      expect.any(Error),
    );

    warn.mockRestore();
  });
});

describe("byFrecency", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("lets a habit outrank a one-off from days earlier", () => {
    const ranked = byFrecency([
      entry("one-off", 1, NOW - 2 * DAY),
      entry("habit", 1, NOW - 4 * DAY, 8),
    ]);
    expect(ranked.map((item) => item.query)).toEqual(["habit", "one-off"]);
  });

  it("keeps a fresh search above an older habit", () => {
    const ranked = byFrecency([
      entry("habit", 1, NOW - 30 * DAY, 8),
      entry("fresh", 1, NOW),
    ]);
    expect(ranked.map((item) => item.query)).toEqual(["fresh", "habit"]);
  });
});
