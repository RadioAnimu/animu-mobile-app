import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const IMG_HEIGHT = 140;

export const styles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: THEME.SPACE.LG,
    paddingBottom: THEME.SPACE.SM,
    gap: THEME.SPACE.MD,
  },
  img: {
    height: IMG_HEIGHT,
    width: "100%",
    borderRadius: THEME.RADIUS.MD,
  },
  programName: {
    color: THEME.COLORS.BRAND,
    fontSize: THEME.FONT_SIZE.HEADING,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textAlign: "center",
  },
  informationBlock: {
    flexDirection: "column",
    gap: THEME.SPACE.SM,
    width: "100%",
    paddingBottom: THEME.SPACE.XS,
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.LIST,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
