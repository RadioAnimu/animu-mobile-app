import { describe, expect, it } from "vitest";
import { resolveLayout } from "@/theme/layout";

/** iPhone 15 in landscape: the island and the home indicator. */
const PHONE_LANDSCAPE_INSETS = { top: 0, right: 59, bottom: 21, left: 59 };

describe("resolveLayout", () => {
  it("keeps a portrait phone a single compact column", () => {
    expect(resolveLayout(393, 852)).toMatchObject({
      windowClass: "compact",
      landscape: false,
      split: false,
      short: false,
      usableWidth: 393,
    });
  });

  it("splits a landscape phone past its side safe areas and flags it short", () => {
    expect(resolveLayout(852, 393, PHONE_LANDSCAPE_INSETS)).toMatchObject({
      usableWidth: 734,
      split: true,
      short: true,
    });
    // iPhone SE landscape (no notch) is still wide enough for two panes.
    expect(resolveLayout(667, 375)).toMatchObject({ windowClass: "medium", split: true, short: true });
  });

  it("does not split a landscape window whose usable width is too narrow", () => {
    expect(resolveLayout(700, 393, PHONE_LANDSCAPE_INSETS).split).toBe(false);
  });

  it("keeps tablet portrait and iPad split-view halves single-column", () => {
    expect(resolveLayout(820, 1180)).toMatchObject({ windowClass: "medium", split: false, short: false });
    expect(resolveLayout(590, 820)).toMatchObject({ windowClass: "compact", split: false });
    expect(resolveLayout(320, 1024)).toMatchObject({ windowClass: "compact", split: false });
  });

  it("splits full-screen tablet landscape, square-ish landscape windows and TVs", () => {
    expect(resolveLayout(1180, 820)).toMatchObject({ windowClass: "expanded", split: true, short: false });
    expect(resolveLayout(800, 760).split).toBe(true);
    expect(resolveLayout(960, 540)).toMatchObject({ split: true });
  });

  it("follows the window across the breakpoints", () => {
    expect(resolveLayout(599, 900).windowClass).toBe("compact");
    expect(resolveLayout(600, 900).windowClass).toBe("medium");
    expect(resolveLayout(839, 900).windowClass).toBe("medium");
    expect(resolveLayout(840, 900).windowClass).toBe("expanded");
    expect(resolveLayout(639, 400).split).toBe(false);
    expect(resolveLayout(640, 400).split).toBe(true);
  });

  it("leaves room for the iPadOS window controls only in a resizable window", () => {
    expect(resolveLayout(1180, 820).windowControlsInset).toBe(0);
    expect(resolveLayout(375, 640, undefined, true).windowControlsInset).toBe(72);
  });
});
