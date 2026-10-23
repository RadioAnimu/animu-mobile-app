import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const CONTAINER_HEIGHT = scale(67);
const VIEW_MIN_HEIGHT = scale(72);
const PLAY_BTN = scale(48);
const ICON_BTN = scale(27);
const PLAY_BTN_MARGIN = scale(47);
const PROGRESS_HEIGHT = scale(5);
const LIVE_BADGE_RIGHT = scale(25);
const LIVE_BADGE_BOTTOM = scale(48);
/**
 * Expands the tap area of the header icons to a comfortable target without
 * changing layout (hitSlop is invisible to flex sizing).
 */
const ICON_HIT_SLOP = scale(14);

/** Space between the lyrics microphone and the note it sits beside. */
const MIC_GAP = scale(28);
/**
 * The microphone glyph fills less of its box than the note artwork does:
 * drawn this much larger, the two read as the same size.
 */
const MIC_SIZE = Math.round(ICON_BTN * 1.25);

/** The bar and its progress slot together (below the status bar inset). */
const BAR_HEIGHT = CONTAINER_HEIGHT + PROGRESS_HEIGHT;

/**
 * Below this row width the play button's side margins give way: the row's
 * three groups (menu, play, note — the microphone hangs off one of them) need
 * ~`scale(300)` and an iPad slide-over / split-view column is narrower than
 * the phone the margins were drawn for.
 */
const NARROW_ROW = scale(360);
/** The play button never sits closer than this to its neighbours. */
const PLAY_BTN_MIN_MARGIN = scale(24);

/**
 * The play button's side margin for a row of this width: the designed one
 * from `NARROW_ROW` up (every phone, in either orientation), shrinking in
 * proportion below it.
 */
const playButtonMargin = (rowWidth: number): number =>
  rowWidth >= NARROW_ROW
    ? PLAY_BTN_MARGIN
    : Math.max(PLAY_BTN_MIN_MARGIN, (PLAY_BTN_MARGIN * rowWidth) / NARROW_ROW);

/**
 * How far the microphone hangs off the menu / note, from its icon's edge:
 * the designed gap on every phone, pulled in with the play button's margins
 * on a narrow row so the mic never crowds the play button.
 */
const micOffset = (rowWidth: number): number =>
  ICON_BTN + (MIC_GAP * playButtonMargin(rowWidth)) / PLAY_BTN_MARGIN;

export { BAR_HEIGHT, CONTAINER_HEIGHT, ICON_HIT_SLOP, MIC_SIZE, micOffset, playButtonMargin };

export const styles = StyleSheet.create({
  view: {
    flexDirection: "column",
    minHeight: VIEW_MIN_HEIGHT,
    // The live-request badge hangs below the bar over the scroll content.
    zIndex: THEME.Z_INDEX.HEADER,
  },
  // Full-bleed SURFACE bar; the row inside is the capped content column so
  // the icons keep their spacing on tablets instead of drifting apart.
  // Stretch follows the window on resize instead of pinning the launch width.
  container: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.COLORS.SURFACE,
    height: CONTAINER_HEIGHT,
  },
  // The row's width is applied by the component (`contentWidth` of the
  // current window): full width on phones, the capped column on tablets.
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    height: "100%",
  },
  playBtn: {
    width: PLAY_BTN,
    height: PLAY_BTN,
    marginHorizontal: PLAY_BTN_MARGIN,
  },
  menuBtn: {
    width: ICON_BTN,
    height: ICON_BTN,
  },
  noteIcon: {
    width: ICON_BTN,
    height: ICON_BTN,
  },
  /** Holds the bar's height whether or not the bar is shown. */
  progressSlot: {
    width: "100%",
    height: PROGRESS_HEIGHT,
  },
  progressBarView: {
    width: "100%",
    height: "100%",
    backgroundColor: THEME.COLORS.BRAND,
    // scaleX is driven natively; anchor at the left edge so the bar grows
    // from 0 → full width instead of scaling about its center.
    transformOrigin: "left",
  },
  /** Muted bar while the audible clock is still being measured. */
  progressBarSyncing: {
    backgroundColor: THEME.COLORS.SWITCH_OFF,
  },
  noteWrapper: {
    position: "relative",
  },
  /**
   * The menu's slot: during live programs the microphone hangs off its
   * right, out of the row's flex — the live badge would otherwise cover a
   * mic parked beside the note.
   */
  menuSlot: {
    position: "relative",
  },
  /**
   * The note's slot: otherwise the microphone hangs off its left, out of
   * the row's flex. Either way the play button stays centered.
   */
  noteSlot: {
    position: "relative",
  },
  /** Mic right of the menu (live badge shown): mirrors the note-side spot. */
  lyricsButtonByMenu: {
    position: "absolute",
    left: ICON_BTN + MIC_GAP,
    // Centered on the menu icon's line.
    top: (ICON_BTN - MIC_SIZE) / 2,
  },
  /** Mic left of the note (no live badge). */
  lyricsButtonByNote: {
    position: "absolute",
    right: ICON_BTN + MIC_GAP,
    // Centered on the note's line.
    top: (ICON_BTN - MIC_SIZE) / 2,
  },
  liveRequestBadge: {
    position: "absolute",
    right: LIVE_BADGE_RIGHT,
    bottom: LIVE_BADGE_BOTTOM,
  },
});
