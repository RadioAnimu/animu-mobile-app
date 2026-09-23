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
 * Width of the centered content column. Equals the device width on
 * phones; on tablets it stops at `DESIGN_WIDTH * MAX_SCALE` so bars and
 * rows stay a comfortable width instead of stretching edge to edge.
 */
export const CONTENT_WIDTH = Math.min(width, DESIGN_WIDTH * MAX_SCALE);
