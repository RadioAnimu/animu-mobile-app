import { StyleSheet } from "react-native";
import { THEME } from "@/theme";

export const styles = StyleSheet.create({
  container: {
    minHeight: THEME.LAYOUT.TOUCH_TARGET,
    maxWidth: THEME.LAYOUT.CONTENT_WIDTH,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  label: {
    textAlign: "center",
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  green: {
    color: THEME.COLORS.BRAND,
  },
});
