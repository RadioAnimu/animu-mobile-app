import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

const TRACK_WIDTH = Dimensions.get("window").width;
const INFO_MARGIN = 14;
/** Designer-specified tight leading between the ticker lines. */
const INFO_GAP = -3.823;
const TITLE_MARGIN_TOP = 7;

export const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    width: TRACK_WIDTH,
    backgroundColor: THEME.COLORS.SURFACE,
  },
  info: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    overflow: "hidden",
    marginHorizontal: INFO_MARGIN,
    gap: INFO_GAP,
  },
  title: {
    color: THEME.COLORS.BRAND,
    fontSize: THEME.FONT_SIZE.TITLE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textAlign: "left",
    marginTop: TITLE_MARGIN_TOP,
  },
  song: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.HEADING,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
  },
  artist: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.HEADING,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  hiddenMeasurement: {
    position: "absolute",
    opacity: 0,
    zIndex: -1,
  },
});
