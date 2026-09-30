import { describe, expect, it, vi } from "vitest";

import { cardThemeFromAccent, hexLuminance } from "@/screens/Stats/card-theme";

vi.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
  PixelRatio: { getFontScale: () => 1 },
}));

describe("hexLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(hexLuminance("#000000")).toBeCloseTo(0, 5);
    expect(hexLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("expands 3-digit hex and accepts a missing #", () => {
    expect(hexLuminance("#fff")).toBeCloseTo(1, 5);
    expect(hexLuminance("000")).toBeCloseTo(0, 5);
    expect(hexLuminance("#f00")).toBeCloseTo(hexLuminance("#ff0000"), 5);
  });

  it("weights green above red above blue (WCAG)", () => {
    const red = hexLuminance("#ff0000");
    expect(red).toBeCloseTo(0.2126, 4);
    expect(hexLuminance("#00ff00")).toBeCloseTo(0.7152, 4);
    expect(hexLuminance("#0000ff")).toBeCloseTo(0.0722, 4);
  });

  it("uses the linear branch for very dark channels", () => {
    // 0x03/255 <= 0.03928 -> v / 12.92
    expect(hexLuminance("#030303")).toBeCloseTo(3 / 255 / 12.92, 6);
  });

  it("returns 0 for malformed input", () => {
    expect(hexLuminance("not-a-color")).toBe(0);
    expect(hexLuminance("#12345")).toBe(0);
  });
});

describe("cardThemeFromAccent", () => {
  it("uses the light stain + ink text for bright accents", () => {
    const theme = cardThemeFromAccent("#ffffff");
    expect(theme.scrim).toBe("rgba(255, 255, 255, 0.42)");
  });

  it("uses the dark stain + white text for dark accents", () => {
    const theme = cardThemeFromAccent("#000000");
    expect(theme.scrim).toBe("rgba(22, 1, 53, 0.55)");
    expect(theme.subtext).toBe("rgba(255, 255, 255, 0.72)");
  });

  it("defaults to the dark theme without an accent", () => {
    expect(cardThemeFromAccent(undefined)).toEqual(cardThemeFromAccent("#000"));
  });
});
