/**
 * Window-driven layout — the one place that measures the window the app is
 * given and names its class.
 *
 * Sizes (type, controls, spacing) come from `scale()` and are fixed per
 * device; this module only feeds ARRANGEMENT: a centered single column, or
 * two panes side by side. It is fed the live window size (never the physical
 * screen), so it follows rotation, iPad split view / Stage Manager resizing
 * and Android multi-window in real time. Screens make their own decisions
 * from these measurements (each has its own room needs), but every one of
 * them reads the same numbers.
 */

/** Width classes, in window points (Material / Apple size-class aligned). */
export const BREAKPOINT = {
  /** At or above: a tablet-class window (iPad split halves, small tablets). */
  MEDIUM: 600,
  /** At or above: a full tablet / TV window. */
  EXPANDED: 840,
} as const;

/**
 * Narrowest usable width (window minus the side safe areas) that lays the
 * player out in two panes: a landscape phone (≈734pt past the island) and
 * every landscape tablet / TV qualify; an iPad split-view half does not.
 */
export const SPLIT_MIN_WIDTH = 640;
/** Below this height the portrait stack cannot fit a screenful (phone landscape). */
const SHORT_MAX_HEIGHT = 500;

/**
 * Every orientation, for native `Modal`s. iOS presents a modal in its own
 * view controller whose orientations default to PORTRAIT ONLY on iPhone —
 * a sheet opened in landscape would spin the whole app upright. The app
 * itself supports all four, so its modals must too.
 */
export const ALL_ORIENTATIONS: ("portrait" | "portrait-upside-down" | "landscape-left" | "landscape-right")[] = [
  "portrait",
  "portrait-upside-down",
  "landscape-left",
  "landscape-right",
];

/**
 * iPadOS 26 draws its window controls (close · minimize · tile) over the
 * top-leading corner of an app running in a window — not reported as a safe
 * area. Top bars inset their leading items by this much there (measured
 * on iPadOS 26: the controls span ~20–62pt from the window's leading edge).
 */
export const WINDOW_CONTROLS_INSET = 72;
/** How far below the window's top those controls reach (~42pt measured). */
export const WINDOW_CONTROLS_HEIGHT = 48;

export type WindowClass = "compact" | "medium" | "expanded";

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ResponsiveLayout {
  /** Current window size in points. */
  width: number;
  height: number;
  /** The window minus the side safe areas (notch / island in landscape). */
  usableWidth: number;
  windowClass: WindowClass;
  landscape: boolean;
  /**
   * Two panes side by side (player | details, artwork | lyrics): a
   * landscape window with at least `SPLIT_MIN_WIDTH` of usable width. A
   * portrait window keeps the phone's single column — it has the height
   * the stack was designed for.
   */
  split: boolean;
  /** A window too short for the portrait stack — trim vertical chrome. */
  short: boolean;
  /** Running on a TV (D-pad focus, 10-foot viewing). */
  tv: boolean;
  /**
   * Leading room top bars leave for the iPadOS window controls: zero
   * unless the app is in a resizable window (not full screen) on an iPad.
   */
  windowControlsInset: number;
}

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function classify(width: number): WindowClass {
  if (width >= BREAKPOINT.EXPANDED) return "expanded";
  if (width >= BREAKPOINT.MEDIUM) return "medium";
  return "compact";
}

export function resolveLayout(
  width: number,
  height: number,
  insets: EdgeInsets = NO_INSETS,
  tv = false,
  windowed = false,
): ResponsiveLayout {
  const usableWidth = width - insets.left - insets.right;
  const landscape = width > height;

  return {
    width,
    height,
    usableWidth,
    windowClass: classify(width),
    landscape,
    split: landscape && usableWidth >= SPLIT_MIN_WIDTH,
    short: height < SHORT_MAX_HEIGHT,
    tv,
    windowControlsInset: windowed ? WINDOW_CONTROLS_INSET : 0,
  };
}
