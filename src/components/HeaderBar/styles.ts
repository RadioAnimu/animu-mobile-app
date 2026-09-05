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

export { CONTAINER_HEIGHT };

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
    height: PROGRESS_HEIGHT,
    margin: 0,
    padding: 0,
    backgroundColor: THEME.COLORS.BRAND,
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
