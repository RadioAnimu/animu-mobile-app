import { describe, expect, it, vi } from "vitest";

import { resolveLayout } from "@/theme/layout";
import {
  ART_ASPECT,
  headerHeight,
  resolveSplitMetrics,
  resolveStackedCover,
  splitContentWidth,
} from "@/screens/Home/metrics";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

// The mocked screen is 393pt wide, so `scale()` is 1 and every number below
// is in design points.
const PHONE = resolveLayout(852, 393, { top: 0, right: 59, bottom: 21, left: 59 });
const IPAD = resolveLayout(1180, 820, { top: 24, right: 0, bottom: 20, left: 0 });
const SHORT_WIDE = resolveLayout(960, 540);

const metrics = (
  layout: ReturnType<typeof resolveLayout>,
  top: number,
  bottom: number,
  gap: number,
) => resolveSplitMetrics(layout, headerHeight(top), bottom + gap);

describe("splitContentWidth", () => {
  it("leaves a margin on each side and stops at the website's hero width", () => {
    expect(splitContentWidth(734)).toBe(686);
    expect(splitContentWidth(1366)).toBe(1100);
  });
});

describe("resolveSplitMetrics (the website hero)", () => {
  it("gives the program art the website's share, the cover block the rest", () => {
    const m = metrics(PHONE, 0, 21, 8);
    expect(m.contentWidth).toBe(686);
    // 57% of the hero, then the gap, then the cover block.
    expect(m.artWidth).toBe(391);
    expect(m.artWidth + 24 + m.coverColumnWidth).toBe(686);
  });

  it("fits the whole cover block in a landscape phone's first screen", () => {
    // 393 − header 72 − end 29 − top gap 14.5 − listeners, gaps and countdown.
    expect(metrics(PHONE, 0, 21, 8).coverSize).toBe(203);
  });

  it("fits a tablet's whole page, the cover matching the art's height", () => {
    const m = metrics(IPAD, 24, 20, 16);
    expect(m.contentWidth).toBe(1100);
    expect(m.coverSize).toBe(Math.floor(m.artWidth / ART_ASPECT));
    // 960×540: the page (hero and ticker) fits, the cover giving way.
    expect(metrics(SHORT_WIDE, 0, 0, 16).coverSize).toBe(264);
  });

  it("never lets the cover outgrow its column, nor shrink past a floor", () => {
    const narrow = metrics(resolveLayout(660, 600), 0, 0, 16);
    expect(narrow.coverSize).toBeLessThanOrEqual(narrow.coverColumnWidth);
    // Never absurdly small: the page scrolls instead.
    expect(metrics(resolveLayout(1100, 280), 0, 0, 16).coverSize).toBe(120);
  });
});

describe("resolveStackedCover", () => {
  const stacked = (width: number, height: number) =>
    resolveStackedCover(resolveLayout(width, height, { top: 24, right: 0, bottom: 20, left: 0 }), headerHeight(24), 36);

  it("leaves every phone and compact-width window at the stack's own size", () => {
    expect(resolveStackedCover(resolveLayout(393, 852), headerHeight(59), 50)).toBeNull();
    // An iPad split-view half or slide-over is compact-width.
    expect(stacked(590, 1180)).toBeNull();
    expect(stacked(375, 1024)).toBeNull();
  });

  it("is not used by two-pane windows", () => {
    expect(resolveStackedCover(IPAD, headerHeight(24), 36)).toBeNull();
  });

  it("grows the cover into a tall tablet's spare height, capped by the width", () => {
    const air = stacked(820, 1180);
    expect(air).not.toBeNull();
    expect(air!).toBeGreaterThan(240);
    expect(air!).toBeLessThanOrEqual(820 * 0.6);
    // A taller window grows it further, until the width share caps it.
    expect(stacked(820, 1600)).toBe(Math.floor(820 * 0.6));
  });

  it("keeps the stack's size when a tablet-width window has no spare height", () => {
    expect(stacked(700, 700)).toBeNull();
  });
});
