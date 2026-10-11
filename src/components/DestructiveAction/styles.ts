import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { ROW_STYLES } from "@/theme/screen";
import { CONTINUOUS } from "@/theme/shape";

const CONTENT_PADDING = THEME.SPACE.LG;

export const styles = StyleSheet.create({
  // Solid destructive fill in a muted, deep red: keeps the app's all-solid
  // button language without the full-strength error red shouting.
  action: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    backgroundColor: THEME.COLORS.DANGER,
  },
  actionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  iconBox: ROW_STYLES.iconBox,
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
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
    // Slightly dimmed for hierarchy; still ~4.7:1 on the danger fill.
    opacity: THEME.OPACITY.MUTED,
  },
});
