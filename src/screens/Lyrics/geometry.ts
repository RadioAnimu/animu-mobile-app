/**
 * Lyrics-screen geometry: the few numbers that decide ARRANGEMENT (two panes
 * or one, how far the lit line sits below the top) kept pure — no window, no
 * theme — so they can be unit-tested and reused by the worklets.
 */

/**
 * Narrowest usable width (window minus the side safe areas) that gives the
 * lyrics enough room for two panes. Landscape tablets — 1180×820, 1366×1024,
 * Android 1280×800, TV 960×540 — qualify; a landscape phone (852×393 with
 * 59pt side insets leaves 734pt) does not: its lyrics need the full width.
 */
export const TWO_PANE_MIN_WIDTH = 760;

/** Share of the usable width the artwork panel takes when there are two panes. */
export const ARTWORK_PANE_RATIO = 0.38;

/**
 * Most of a short lyrics viewport the lit line may spend above itself: the
 * fixed 64pt anchor is right on a phone, but on a 290pt body it would push
 * the next line off the bottom.
 */
export const ANCHOR_MAX_RATIO = 0.2;
/** Most of a short viewport the edge fade may eat (top and bottom each). */
export const EDGE_FADE_MAX_RATIO = 0.15;

export interface LyricGeometry {
  /** Where the lit line's top sits below the top of the viewport. */
  anchor: number;
  /** Rows fade out over this distance at the viewport's bottom edge. */
  fade: number;
}

/**
 * The lyric geometry for a viewport `height`: the phone's tuned constants,
 * clamped so a short window keeps the lit line and its reading in view and
 * spends at most 15% on each edge fade. A viewport tall enough for the
 * constants (every phone in portrait) is untouched.
 */
export function lyricGeometry(height: number, anchor: number, fade: number): LyricGeometry {
  if (!(height > 0)) return { anchor, fade };
  return {
    anchor: Math.min(anchor, height * ANCHOR_MAX_RATIO),
    fade: Math.min(fade, height * EDGE_FADE_MAX_RATIO),
  };
}

/** The artwork panel's width for a window's usable width (whole points). */
export function artworkPaneWidth(usableWidth: number): number {
  return Math.round(usableWidth * ARTWORK_PANE_RATIO);
}
