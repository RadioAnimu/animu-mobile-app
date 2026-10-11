import { StyleSheet } from "react-native";

import { THEME } from "@/theme";

export const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    // A floor, not a fixed height: a label that wraps at large text grows
    // the button instead of being clipped.
    minHeight: THEME.LAYOUT.CONTROL_HEIGHT,
    paddingHorizontal: THEME.SPACE.XXL,
    paddingVertical: THEME.SPACE.XS,
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
    flexShrink: 1,
    textAlign: "center",
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
