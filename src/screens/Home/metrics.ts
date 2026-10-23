import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { BAR_HEIGHT } from "@/components/HeaderBar/styles";
import { SIZE as COVER_SIZE } from "@/components/Cover/styles";
import type { ResponsiveLayout } from "@/theme/layout";
import { RHYTHM } from "@/screens/Home/styles";

/**
 * Sizes of the landscape Home: the website's hero (animu.moe from 768px up).
 * The program's art on the left — the website's hero image — and on the
 * right the cover block (listeners badge, cover, countdown); the rest of the
 * portrait player follows underneath, full width, and the page scrolls where
 * the height runs out. The rows around the cover are budgeted as authored
 * heights rather than measured with `onLayout` (a measurement feeding back
 * into a size loops during an iPad window drag).
 */

/** Side margin of the hero inside the safe area. */
const EDGE = THEME.SPACE.XXL;
/** Widest the hero grows: the website's own hero container. */
const HERO_MAX_WIDTH = 1100;
/** Gap between the art and the cover block. */
const COLUMN_GAP = THEME.SPACE.XXL;
/** Share of the hero the program's art takes, as on the website. */
const ART_SHARE = 0.57;
/** The program art's proportions (the website's hero image). */
export const ART_ASPECT = 1.92;
/** Smallest cover; below it the page scrolls rather than shrink further. */
const COVER_MIN = scale(120);

// Authored heights of the player's rows (the stretchy cover aside).
const LISTENERS_ROW = scale(32);
const TIME_ROW = scale(18);
const PROGRAM_ROW = scale(48);
const BITRATE_ROW = scale(49);
/** The song ticker's three lines as rendered. */
const TICKER_ROW = scale(84);

/** Under the hero: the song ticker and the program, with their gaps. */
const BELOW_HERO = RHYTHM.TIME_BOTTOM + TICKER_ROW + RHYTHM.LIVE + PROGRAM_ROW + RHYTHM.PROGRAM;
/** The smallest cover worth fitting the whole page for; below it, the page scrolls. */
const PAGE_FIT_MIN_COVER = scale(200);

export interface SplitMetrics {
  /** Width of the hero — the header's icon row matches it. */
  contentWidth: number;
  /** The program art's width; its height follows `ART_ASPECT`. */
  artWidth: number;
  coverColumnWidth: number;
  /** Side of the square frame the cover is held to. */
  coverSize: number;
}

/** Page content width for a landscape window — the header's row uses it too. */
export const splitContentWidth = (usableWidth: number): number =>
  Math.min(usableWidth - 2 * EDGE, HERO_MAX_WIDTH);

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
  const artWidth = Math.round(contentWidth * ART_SHARE);
  const coverColumnWidth = contentWidth - artWidth - COLUMN_GAP;
  // The cover matches the art's height, as on the website, and gives way
  // to the height: where the window can hold the whole page with a cover of
  // a fair size (a tablet), the page fits without scrolling; otherwise (a
  // phone) the whole cover block fits the first screen and the rest scrolls
  // into view.
  const body = layout.height - headerHeight - endPadding - RHYTHM.TIME_BOTTOM;
  const coverChrome = LISTENERS_ROW + RHYTHM.LISTENERS + RHYTHM.COVER + RHYTHM.TIME_TOP + TIME_ROW;
  const fitsPage = body - BELOW_HERO - coverChrome;
  const room = fitsPage >= PAGE_FIT_MIN_COVER ? fitsPage : body - coverChrome;
  const coverSize = Math.floor(
    Math.max(COVER_MIN, Math.min(artWidth / ART_ASPECT, coverColumnWidth, room)),
  );
  return { contentWidth, artWidth, coverColumnWidth, coverSize };
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
