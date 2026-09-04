import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: THEME.COLORS.SHAPE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  playingNow: {
    backgroundColor: THEME.COLORS.REQUEST,
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.SM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  playingNowText: {
    color: THEME.COLORS.WHITE_TEXT,
  },
  textColumn: {
    flexDirection: "column",
    gap: 1,
    flexShrink: 1,
  },
  details: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.FOOTER,
    opacity: 0.8,
  },
});
