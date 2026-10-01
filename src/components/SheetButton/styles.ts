import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { hardShadow } from "@/theme/shape";

// Same recipe as the green banner: brand fill, violet frame, hard shadow.
export const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.SM,
    paddingVertical: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.XL,
    borderRadius: THEME.RADIUS.LG,
    borderWidth: THEME.BORDER_WIDTH.THICK,
    borderColor: THEME.COLORS.FRAME,
    backgroundColor: THEME.COLORS.BRAND,
    ...hardShadow(),
  },
  busy: {
    opacity: THEME.OPACITY.DISABLED,
  },
  label: {
    color: THEME.COLORS.SURFACE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
