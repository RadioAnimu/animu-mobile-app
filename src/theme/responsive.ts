import { Dimensions } from "react-native";

/**
 * Design reference: iPhone 15 Pro — 1179×2556 px @3x = 393×852 pt.
 *
 * Every dimension in the app is authored against this width. `scale()`
 * then maps it to the actual device, so the layout keeps the same
 * proportions on every phone instead of looking sparse on large screens.
 */
const DESIGN_WIDTH = 393;

/**
 * Tablets and TVs are far wider than a phone. Scaling 1:1 would turn the
 * phone layout into a billboard, so the factor is clamped here and the
 * extra room goes to layout (centered columns, side-by-side panes) instead.
 * At 1.2 a tablet's body copy lands on the platform's own (~17pt on iPad)
 * and the phone's fixed-width groups still fit a 375pt split-view window.
 */
const MAX_SCALE = 1.2;

/**
 * The factor is a property of the DEVICE, not of the window: it is taken
 * from the physical screen's short side, which no rotation, split view,
 * Stage Manager resize or Android freeform window changes. Type and
 * controls therefore keep one size for the app's whole life — like a
 * native iPad app — while `useResponsiveLayout()` re-arranges the layout
 * for the window it actually gets. On a phone in portrait the short side
 * IS the window width, so phones scale exactly as they always have, and a
 * phone launched in landscape no longer blows up to the tablet cap.
 */
const screen = Dimensions.get("screen");
const shortSide = Math.min(screen.width, screen.height);

/** Uniform scale factor, clamped for tablets and TVs. */
const ratio = Math.min(shortSide / DESIGN_WIDTH, MAX_SCALE);

/**
 * Scales any authored size — lengths, font sizes, radii, spacing, icon
 * sizes — so the whole interface grows together and proportions hold.
 */
export const scale = (size: number): number => size * ratio;

/**
 * Fraction of the screen the page content column occupies before the cap.
 * Mirrors `THEME.LAYOUT.CONTENT_WIDTH` ("88%") — one column spec, used by
 * both the full-screen pages and the header's icon row.
 */
const CONTENT_WIDTH_RATIO = 0.88;

/** Tablet cap on the content column. Single source for `THEME.LAYOUT.CONTENT_MAX_WIDTH`. */
export const CONTENT_MAX_WIDTH = scale(560);

/**
 * Width of the shared centered content column for a window width.
 *
 * On phones the column is the full device width (the header stays full-bleed
 * and pages are inset by `CONTENT_WIDTH_RATIO` via their own style). Once the
 * device is wider than the column cap — a tablet — this returns the SAME
 * `min(88%, cap)` the pages use, so the header's icons align with the page
 * content instead of ending up narrower than it.
 *
 * Takes the width as an argument (the header passes `useWindowDimensions()`)
 * so it survives the window rotating or resizing after launch instead of
 * sizing against a frozen module-load width.
 */
export const contentWidth = (windowWidth: number): number =>
  windowWidth > CONTENT_MAX_WIDTH
    ? Math.min(windowWidth * CONTENT_WIDTH_RATIO, CONTENT_MAX_WIDTH)
    : windowWidth;
