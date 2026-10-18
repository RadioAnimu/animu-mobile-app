// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useRecentSearches } from "@/hooks/useRecentSearches";

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

afterEach(() => {
  cleanup();
  memory.clear();
});

describe("useRecentSearches", () => {
  it("loads what was stored", async () => {
    memory.set("recentSearches", JSON.stringify(["naruto"]));
    const { result } = renderHook(() => useRecentSearches());
    await act(async () => undefined);
    expect(result.current.recent.map((item) => item.query)).toEqual(["naruto"]);
  });

  it("a clear tapped while an add is in flight stays cleared", async () => {
    const { result } = renderHook(() => useRecentSearches());
    await act(async () => {
      result.current.addRecent("naruto", 5);
      result.current.clearRecent();
    });
    expect(result.current.recent).toEqual([]);
    expect(memory.has("recentSearches")).toBe(false);
  });

  it("a slow first read does not undo an earlier change", async () => {
    memory.set("recentSearches", JSON.stringify(["old"]));
    const { result } = renderHook(() => useRecentSearches());
    // Before the initial read has resolved.
    act(() => result.current.clearRecent());
    await act(async () => undefined);
    expect(result.current.recent).toEqual([]);
  });
});
