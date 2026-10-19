import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const INFO_MARGIN = scale(14);
/** Designer-specified tight leading between the ticker lines. */
const INFO_GAP = scale(-3.823);
/** Trims the font's descender space so the ink block centers vertically. */
const INFO_PADDING_BOTTOM = scale(3);

export const styles = StyleSheet.create({
  // Full-bleed ticker: stretches to the screen's safe width, so it follows
  // the window when it resizes (the marquee lines re-measure via onLayout).
  track: {
    alignSelf: "stretch",
    flexDirection: "row",
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
  /** Placeholder lines: a real glyph so they measure like text, unseen. */
  blank: {
    opacity: 0,
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
