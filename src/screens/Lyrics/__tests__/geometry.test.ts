import { describe, expect, it } from "vitest";
import {
  ANCHOR_MAX_RATIO,
  ARTWORK_PANE_RATIO,
  EDGE_FADE_MAX_RATIO,
  TWO_PANE_MIN_WIDTH,
  artworkPaneWidth,
  lyricGeometry,
} from "@/screens/Lyrics/geometry";

/** The phone's tuned constants (see `LYRIC` in styles.ts). */
const ANCHOR = 64;
const FADE = 72;

describe("lyricGeometry", () => {
  it("leaves a tall viewport on the tuned constants", () => {
    // iPhone 15 portrait: the lyrics body is ~648pt tall.
    expect(lyricGeometry(648, ANCHOR, FADE)).toEqual({ anchor: ANCHOR, fade: FADE });
  });

  it("clamps anchor and fade to the viewport in a short body", () => {
    const short = lyricGeometry(300, ANCHOR, FADE);
    expect(short.anchor).toBeCloseTo(300 * ANCHOR_MAX_RATIO);
    expect(short.fade).toBeCloseTo(300 * EDGE_FADE_MAX_RATIO);
    expect(short.anchor).toBeLessThan(ANCHOR);
    expect(short.fade).toBeLessThan(FADE);
  });

  it("caps at 20% / 15% of the body once they bite", () => {
    const tiny = lyricGeometry(100, ANCHOR, FADE);
    expect(tiny.anchor).toBeCloseTo(20);
    expect(tiny.fade).toBeCloseTo(15);
  });

  it("falls back to the constants before the body is measured", () => {
    expect(lyricGeometry(0, ANCHOR, FADE)).toEqual({ anchor: ANCHOR, fade: FADE });
    expect(lyricGeometry(Number.NaN, ANCHOR, FADE)).toEqual({ anchor: ANCHOR, fade: FADE });
  });
});

describe("two-pane geometry", () => {
  it("needs 760pt of usable width so a landscape phone stays single-pane", () => {
    expect(TWO_PANE_MIN_WIDTH).toBe(760);
    // 852×393 with 59pt side insets: 734 usable.
    expect(734).toBeLessThan(TWO_PANE_MIN_WIDTH);
    // Landscape tablets and TVs.
    expect(1180).toBeGreaterThanOrEqual(TWO_PANE_MIN_WIDTH);
    expect(960).toBeGreaterThanOrEqual(TWO_PANE_MIN_WIDTH);
  });

  it("gives the artwork panel 38% of the usable width", () => {
    expect(ARTWORK_PANE_RATIO).toBeCloseTo(0.38);
    expect(artworkPaneWidth(1180)).toBe(448);
    expect(artworkPaneWidth(960)).toBe(365);
  });
});
