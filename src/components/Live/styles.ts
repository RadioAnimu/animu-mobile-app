import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

const TRACK_WIDTH = Dimensions.get("window").width;
const INFO_MARGIN = 14;
/** Designer-specified tight leading between the ticker lines. */
const INFO_GAP = -3.823;
/** Trims the font's descender space so the ink block centers vertically. */
const INFO_PADDING_BOTTOM = 3;

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
    paddingBottom: INFO_PADDING_BOTTOM,
    gap: INFO_GAP,
  },
  title: {
    color: THEME.COLORS.BRAND,
    fontSize: THEME.FONT_SIZE.TITLE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textAlign: "left",
    includeFontPadding: false,
  },
  song: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.HEADING,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    includeFontPadding: false,
  },
  artist: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.HEADING,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    includeFontPadding: false,
  },
});
