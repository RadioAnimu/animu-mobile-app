import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

const CONTAINER_HEIGHT = 67;
const VIEW_MIN_HEIGHT = 72;
const PLAY_BTN = 48;
const ICON_BTN = 27;
const PLAY_BTN_MARGIN = 47;
const PROGRESS_HEIGHT = 5;
const LIVE_BADGE_RIGHT = 25;
const LIVE_BADGE_BOTTOM = 48;
/**
 * Expands the tap area of the 27px header icons to a comfortable ~55px
 * target without changing layout (hitSlop is invisible to flex sizing).
 */
const ICON_HIT_SLOP = 14;

export { CONTAINER_HEIGHT, ICON_HIT_SLOP };

export const styles = StyleSheet.create({
  view: {
    flexDirection: "column",
    minHeight: VIEW_MIN_HEIGHT,
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: THEME.COLORS.SURFACE,
    width: Dimensions.get("window").width,
    height: CONTAINER_HEIGHT,
  },
  playBtn: {
    width: PLAY_BTN,
    height: PLAY_BTN,
    objectFit: "contain",
    marginHorizontal: PLAY_BTN_MARGIN,
  },
  menuBtn: {
    width: ICON_BTN,
    height: ICON_BTN,
    objectFit: "contain",
  },
  noteIcon: {
    width: ICON_BTN,
    height: ICON_BTN,
    objectFit: "contain",
  },
  progressBarView: {
    width: "100%",
    height: PROGRESS_HEIGHT,
    margin: 0,
    padding: 0,
    backgroundColor: THEME.COLORS.BRAND,
    // scaleX is driven natively; anchor at the left edge so the bar grows
    // from 0 → full width instead of scaling about its center.
    transformOrigin: "left",
  },
  noteWrapper: {
    position: "relative",
  },
  liveRequestBadge: {
    position: "absolute",
    right: LIVE_BADGE_RIGHT,
    bottom: LIVE_BADGE_BOTTOM,
  },
});
