import { beforeEach, describe, expect, it, vi } from "vitest";

import { recentSearchesService } from "@/core/services/recent-searches.service";

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

describe("recentSearchesService", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("returns an empty list before anything is stored", async () => {
    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("keeps the newest query first", async () => {
    await recentSearchesService.add("one");
    await recentSearchesService.add("two");

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      "two",
      "one",
    ]);
  });

  it("de-duplicates a repeated query by moving it to the front", async () => {
    await recentSearchesService.add("one");
    await recentSearchesService.add("two");
    await recentSearchesService.add("one");

    await expect(recentSearchesService.getAll()).resolves.toEqual([
      "one",
      "two",
    ]);
  });

  it("caps the list at five entries", async () => {
    for (const query of ["a", "b", "c", "d", "e", "f"]) {
      await recentSearchesService.add(query);
    }

    const all = await recentSearchesService.getAll();
    expect(all).toHaveLength(5);
    expect(all[0]).toBe("f");
  });

  it("discards a corrupt stored value", async () => {
    memory.set("recentSearches", "{not json");

    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });

  it("clears every stored query", async () => {
    await recentSearchesService.add("one");
    await recentSearchesService.clear();

    await expect(recentSearchesService.getAll()).resolves.toEqual([]);
  });
});
