import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

export const styles = StyleSheet.create({
  // Solid destructive fill in a muted, deep red: keeps the app's all-solid
  // button language without the full-strength error red shouting.
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    minHeight: scale(64),
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.CARD,
    backgroundColor: THEME.COLORS.DANGER,
  },
  actionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  /** Inside a shared danger-group card: the card owns the fill and radius. */
  actionGrouped: {
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  body: {
    flex: 1,
    gap: THEME.SPACE.XS,
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  description: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.BODY,
    // Slightly dimmed for hierarchy; still ~4.7:1 on the danger fill.
    opacity: 0.85,
  },
});
