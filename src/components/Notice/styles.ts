import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { CONTINUOUS } from "@/theme/shape";

export const styles = StyleSheet.create({
  // Explains a rule without becoming a card, so it stays transparent over
  // the artwork.
  notice: {
    alignItems: "flex-start",
    borderColor: THEME.COLORS.HAIRLINE_SOFT,
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    borderWidth: 1,
    flexDirection: "row",
    gap: THEME.SPACE.SM,
    padding: THEME.SPACE.MD,
  },
  text: {
    color: THEME.COLORS.TEXT_SOFT,
    flex: 1,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    lineHeight: THEME.LINE_HEIGHT.CAPTION,
  },
});
