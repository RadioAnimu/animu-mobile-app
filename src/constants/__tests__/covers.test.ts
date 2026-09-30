import { describe, expect, it, vi } from "vitest";

import { COVER_CATEGORY_COLORS, coverCategoryLabel } from "@/constants/covers";
import type { Dict } from "@/i18n";

vi.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
  PixelRatio: { getFontScale: () => 1 },
}));

const dict = {
  SETTINGS_STORAGE_LIVE: "live-label",
  SETTINGS_STORAGE_REQUESTED: "requested-label",
  SETTINGS_STORAGE_PLAYED: "played-label",
  SETTINGS_STORAGE_SEARCH: "search-label",
} as unknown as Dict;

describe("coverCategoryLabel", () => {
  it.each([
    ["live", "live-label"],
    ["requested", "requested-label"],
    ["played", "played-label"],
    ["search", "search-label"],
  ] as const)("maps %s to its localized label", (category, label) => {
    expect(coverCategoryLabel(dict, category)).toBe(label);
  });
});

describe("COVER_CATEGORY_COLORS", () => {
  it("gives every category its own color", () => {
    const colors = Object.values(COVER_CATEGORY_COLORS);
    expect(Object.keys(COVER_CATEGORY_COLORS).sort()).toEqual([
      "live",
      "played",
      "requested",
      "search",
    ]);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
