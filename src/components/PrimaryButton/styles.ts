import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    height: scale(48),
    paddingHorizontal: THEME.SPACE.XXL,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.BRAND,
  },
  // Flat grey instead of faded green, which reads as muddy olive on purple.
  disabled: {
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  labelDisabled: {
    color: THEME.COLORS.TEXT_DIM,
  },
  label: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
