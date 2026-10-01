import { StyleSheet } from "react-native";
import { THEME } from "@/theme";

export const styles = StyleSheet.create({
  sticker: {
    alignSelf: "flex-start",
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.XS,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.BRAND,
    transform: [{ rotate: "5deg" }],
  },
  text: {
    color: THEME.COLORS.SURFACE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
