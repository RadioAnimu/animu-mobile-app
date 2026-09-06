import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XL,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
  },
  label: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    color: THEME.COLORS.TEXT,
    letterSpacing: 0.4,
  },
});
