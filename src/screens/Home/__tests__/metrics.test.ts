import { describe, expect, it, vi } from "vitest";

import { resolveLayout } from "@/theme/layout";
import {
  BANNER_ASPECT,
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
const TV = resolveLayout(960, 540, undefined, true);

const metrics = (
  layout: ReturnType<typeof resolveLayout>,
  top: number,
  bottom: number,
  gap: number,
) => resolveSplitMetrics(layout, headerHeight(top), bottom + gap);

describe("splitContentWidth", () => {
  it("leaves a margin on each side and stops growing past the cap", () => {
    expect(splitContentWidth(734)).toBe(686);
    expect(splitContentWidth(1366)).toBe(900);
  });
});

describe("resolveSplitMetrics", () => {
  it("fits a landscape phone: no banner, shrunk logo, cover to the room left", () => {
    const m = metrics(PHONE, 0, 21, 8);
    expect(m.contentWidth).toBe(686);
    expect(m.infoWidth + m.artWidth + 24).toBe(686);
    expect(m.bannerWidth).toBeNull();
    // Between 55% and the full logo, whichever the info pane fits.
    expect(m.logoHeight).toBeGreaterThanOrEqual(Math.round(127 * 0.55));
    expect(m.logoHeight).toBeLessThan(127);
    // 393 − header 72 − ticker 96 − end 29 − the art column's chrome.
    expect(m.coverSize).toBe(130);
  });

  it("gives a roomy tablet window the banner, within the info pane", () => {
    const m = metrics(IPAD, 24, 20, 16);
    expect(m.logoHeight).toBe(127);
    expect(m.bannerWidth).not.toBeNull();
    expect(m.bannerWidth!).toBeLessThanOrEqual(m.infoWidth);
    expect(m.bannerWidth!).toBeGreaterThan(m.infoWidth * 0.9);
    // The cover may outgrow the stack's 240 square (here up to its 1.7×
    // cap), never the art pane.
    expect(m.coverSize).toBe(Math.floor(240 * 1.7));
    expect(m.coverSize).toBeLessThanOrEqual(m.artWidth);
  });

  it("decides the banner by the body's height, not the device", () => {
    // A TV's 540pt window has a ~470pt body: no banner.
    expect(metrics(TV, 0, 0, 16).bannerWidth).toBeNull();
    // Same width and any device: 600pt of body (window − 72 header) is the line.
    const at = (height: number) =>
      metrics(resolveLayout(1100, height), 0, 0, 16).bannerWidth;
    expect(at(671)).toBeNull();
    expect(at(672)).not.toBeNull();
  });

  it("keeps the banner in the 1.92:1 proportions of the website's hero", () => {
    const m = metrics(IPAD, 24, 20, 16);
    expect(m.bannerWidth! / BANNER_ASPECT).toBeLessThanOrEqual(
      m.infoWidth / BANNER_ASPECT,
    );
  });

  it("bounds the cover by the room the window leaves, down to a floor", () => {
    const wide = (height: number) =>
      metrics(resolveLayout(1100, height), 0, 0, 16).coverSize;
    expect(wide(1000)).toBe(408);
    // Shorter windows give it less height, down to the floor.
    expect(wide(560)).toBeLessThan(408);
    expect(wide(480)).toBeLessThan(wide(560));
    expect(wide(520)).toBeGreaterThan(wide(440));
    // Never absurdly small: the page scrolls instead.
    expect(wide(300)).toBe(120);
  });

  it("never lets the cover outgrow the art pane", () => {
    const narrow = metrics(resolveLayout(660, 600), 0, 0, 16);
    expect(narrow.coverSize).toBeLessThanOrEqual(narrow.artWidth);
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
