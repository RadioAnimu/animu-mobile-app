import { Dimensions } from "react-native";

/**
 * Design reference: iPhone 15 Pro — 1179×2556 px @3x = 393×852 pt.
 *
 * Every dimension in the app is authored against this width. `scale()`
 * then maps it to the actual device, so the layout keeps the same
 * proportions on every phone instead of looking sparse on large screens.
 */
export const DESIGN_WIDTH = 393;

/**
 * Tablets are far wider than a phone. Scaling 1:1 would turn the phone
 * layout into a billboard, so the factor is clamped here and the content
 * column is centered instead.
 */
export const MAX_SCALE = 1.3;

const { width } = Dimensions.get("window");

/** Uniform scale factor, clamped for tablets. */
const ratio = Math.min(width / DESIGN_WIDTH, MAX_SCALE);

/**
 * Scales any authored size — lengths, font sizes, radii, spacing, icon
 * sizes — so the whole interface grows together and proportions hold.
 */
export const scale = (size: number): number => size * ratio;

/** Full device width — for full-bleed surfaces (header bar, ticker). */
export const SCREEN_WIDTH = width;

/**
 * Fraction of the screen the page content column occupies before the cap.
 * Mirrors `THEME.LAYOUT.CONTENT_WIDTH` ("88%") — one column spec, used by
 * both the full-screen pages and the header's icon row.
 */
export const CONTENT_WIDTH_RATIO = 0.88;

/** Tablet cap on the content column. Single source for `THEME.LAYOUT.CONTENT_MAX_WIDTH`. */
export const CONTENT_MAX_WIDTH = scale(560);

/**
 * Width of the shared centered content column.
 *
 * On phones the column is the full device width (the header stays full-bleed
 * and pages are inset by `CONTENT_WIDTH_RATIO` via their own style). Once the
 * device is wider than the column cap — a tablet — this returns the SAME
 * `min(88%, cap)` the pages use, so the header's icons align with the page
 * content instead of ending up narrower than it.
 */
export const CONTENT_WIDTH =
  width > CONTENT_MAX_WIDTH
    ? Math.min(width * CONTENT_WIDTH_RATIO, CONTENT_MAX_WIDTH)
    : width;
