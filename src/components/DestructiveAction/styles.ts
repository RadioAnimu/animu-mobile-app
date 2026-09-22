import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

export const styles = StyleSheet.create({
  // Outlined error card: loud enough to read as destructive, quiet enough
  // that it doesn't shout from the bottom of a settings page.
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    minHeight: scale(52),
    paddingHorizontal: CONTENT_PADDING,
    borderRadius: THEME.RADIUS.CARD,
    borderWidth: 1,
    borderColor: THEME.COLORS.ERROR_BORDER,
    backgroundColor: THEME.COLORS.ERROR_SUBTLE,
  },
  actionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  body: {
    flex: 1,
    gap: THEME.SPACE.XXS,
  },
  label: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  description: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: THEME.LINE_HEIGHT.BODY,
  },
});
