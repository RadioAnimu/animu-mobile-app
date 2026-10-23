import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { BAR_HEIGHT } from "@/components/HeaderBar/styles";
import { SIZE as COVER_SIZE } from "@/components/Cover/styles";
import type { ResponsiveLayout } from "@/theme/layout";
import { RHYTHM } from "@/screens/Home/styles";

/**
 * Sizes of the split (two-pane) Home. The cover and the program banner are
 * the only pieces that stretch, and they need to know how much room the
 * window leaves them — so the player's other rows are budgeted here, as
 * authored heights, instead of measured with `onLayout` (a measurement that
 * feeds back into a size loops during an iPad window drag). The budgets lean
 * a little generous: an overrun scrolls, it never clips.
 */

/** Widest the two panes grow; past it a bigger window only adds margin. */
const MAX_CONTENT_WIDTH = scale(900);
/** Info pane's share of the pane space (info : art ≈ 1.1 : 1). */
const INFO_SHARE = 1.1 / 2.1;
/**
 * The cover may outgrow the stack's square where there is room for it — up
 * to this much. The window's height is what really bounds it (see the
 * budget below): a landscape iPad Air lands near 1.5×, a 13" iPad Pro uses
 * the full step instead of leaving a band of empty space under the ticker.
 */
const COVER_GROWTH = 1.7;
/** Smallest cover; below it the page scrolls rather than shrink further. */
const COVER_MIN = scale(120);
/**
 * How far the decorative logo (and its scope) shrinks to fit a short window:
 * a landscape phone keeps ~190pt for the panes, and the program, bitrate and
 * song ticker matter more than the logo's size.
 */
const LOGO_MIN_RATIO = 0.55;
/** The program banner's proportions (the website's hero image). */
export const BANNER_ASPECT = 1.92;
/** The banner needs a body at least this tall (pt): see `resolveSplitMetrics`. */
const BANNER_MIN_BODY_HEIGHT = 600;
const BANNER_MIN_HEIGHT = scale(110);

// Authored heights of the rows around the stretchy pieces.
const LISTENERS_ROW = scale(32);
const TIME_ROW = scale(18);
const PROGRAM_ROW = scale(48);
const BITRATE_ROW = scale(49);
/**
 * The song ticker's three lines as rendered (measured on an iPhone SE in
 * landscape, where an under-estimate pushes its last line off the window).
 */
const TICKER_ROW = scale(84);

const GAP = {
  /** Between the stacked blocks of the info pane. */
  ROOMY: THEME.SPACE.MD,
  SHORT: THEME.SPACE.SM,
};
/** Art column rhythm: the stack's, tightened where height is scarce. */
const TIGHT_RHYTHM = { LISTENERS: scale(6), COVER: scale(6) };

export interface SplitMetrics {
  /** Width of the two panes together — the header's icon row matches it. */
  contentWidth: number;
  infoWidth: number;
  artWidth: number;
  /** Logo height; the oscilloscope strip follows it. */
  logoHeight: number;
  /** Side of the square frame the cover is held to. */
  coverSize: number;
  /** Banner width (height is `width / BANNER_ASPECT`); null when there is no room. */
  bannerWidth: number | null;
  /** Gap between the info pane's blocks. */
  gap: number;
  listenersGap: number;
  coverGap: number;
}

/** Page content width for a split window — the header's row uses it too. */
export const splitContentWidth = (usableWidth: number): number =>
  Math.min(usableWidth - 2 * THEME.SPACE.XXL, MAX_CONTENT_WIDTH);

/**
 * @param headerHeight the pinned header (bar, progress slot, status bar)
 * @param endPadding the spacer under the content (home indicator + gap)
 */
export function resolveSplitMetrics(
  layout: ResponsiveLayout,
  headerHeight: number,
  endPadding: number,
): SplitMetrics {
  const contentWidth = splitContentWidth(layout.usableWidth);
  const paneSpace = contentWidth - THEME.SPACE.XXL;
  const infoWidth = Math.floor(paneSpace * INFO_SHARE);
  const artWidth = paneSpace - infoWidth;

  const gap = layout.short ? GAP.SHORT : GAP.ROOMY;
  const listenersGap = layout.short ? TIGHT_RHYTHM.LISTENERS : RHYTHM.LISTENERS;
  const coverGap = layout.short ? TIGHT_RHYTHM.COVER : RHYTHM.COVER;

  // What the panes may use: the window minus the header, the ticker under
  // them and the end padding.
  const budget =
    layout.height - headerHeight - (TICKER_ROW + THEME.SPACE.MD) - endPadding;

  const artChrome = LISTENERS_ROW + listenersGap + coverGap + RHYTHM.TIME_TOP + TIME_ROW;
  const coverCap = COVER_SIZE * (layout.short ? 1 : COVER_GROWTH);
  const coverSize = Math.floor(
    Math.max(COVER_MIN, Math.min(coverCap, artWidth, budget - artChrome)),
  );

  // The banner is for windows with a body this tall (a TV's, a landscape
  // phone's are not — whatever the device) and takes what the logo, the
  // program line and the bitrate row leave of the budget.
  const below = gap + PROGRAM_ROW + RHYTHM.PROGRAM + BITRATE_ROW;
  const bodyHeight = layout.height - headerHeight;
  const bannerRoom = budget - (THEME.LAYOUT.LOGO_HEIGHT + below + gap);
  const bannerHeight = Math.min(infoWidth / BANNER_ASPECT, bannerRoom);
  const roomy =
    !layout.short &&
    bodyHeight >= BANNER_MIN_BODY_HEIGHT &&
    bannerHeight >= BANNER_MIN_HEIGHT;

  // Without a banner the logo takes what is left, between 70% and its full height.
  const logoHeight = roomy
    ? THEME.LAYOUT.LOGO_HEIGHT
    : Math.round(
        Math.min(
          THEME.LAYOUT.LOGO_HEIGHT,
          Math.max(THEME.LAYOUT.LOGO_HEIGHT * LOGO_MIN_RATIO, budget - below),
        ),
      );

  return {
    contentWidth,
    infoWidth,
    artWidth,
    logoHeight,
    coverSize,
    bannerWidth: roomy ? Math.floor(bannerHeight * BANNER_ASPECT) : null,
    gap,
    listenersGap,
    coverGap,
  };
}

/** Widest the stacked cover grows, as a share of the window (tablet portrait). */
const STACKED_COVER_WIDTH_SHARE = 0.6;
/** Share of the spare height the stacked cover takes; the rest stays as air. */
const STACKED_COVER_HEIGHT_SHARE = 0.75;

/**
 * Cover side for the single-column player in a tablet-width window (a
 * tablet in portrait): the stack was drawn for a phone, so on a tall tablet
 * it would float in a sea of space with a phone-sized cover. The cover grows
 * into the spare height instead — like Apple Music's iPad artwork — capped
 * at a share of the width so it never crowds the column. Null keeps the
 * stack's own size (every phone, and iPad split-view halves, which are
 * compact-width).
 */
export function resolveStackedCover(
  layout: ResponsiveLayout,
  headerHeight: number,
  endPadding: number,
): number | null {
  if (layout.split || layout.windowClass === "compact") return null;
  const chrome =
    THEME.LAYOUT.LOGO_HEIGHT +
    LISTENERS_ROW + RHYTHM.LISTENERS +
    RHYTHM.COVER + RHYTHM.TIME_TOP + TIME_ROW + RHYTHM.TIME_BOTTOM +
    TICKER_ROW + RHYTHM.LIVE +
    PROGRAM_ROW + RHYTHM.PROGRAM +
    BITRATE_ROW;
  const room = layout.height - headerHeight - endPadding - chrome;
  if (room <= COVER_SIZE) return null;
  const grown = COVER_SIZE + (room - COVER_SIZE) * STACKED_COVER_HEIGHT_SHARE;
  return Math.floor(Math.max(COVER_SIZE, Math.min(grown, layout.usableWidth * STACKED_COVER_WIDTH_SHARE)));
}

/** The pinned header's height: the bar and progress slot under the status bar. */
export const headerHeight = (topInset: number): number => BAR_HEIGHT + topInset;
