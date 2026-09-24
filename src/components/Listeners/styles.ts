import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const HEADPHONES_ICON = scale(20);

export const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    borderRadius: THEME.RADIUS.LG,
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: THEME.SPACE.XXS,
    gap: THEME.SPACE.XS,
  },
  text: {
    fontSize: THEME.FONT_SIZE.HEADING,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    verticalAlign: "middle",
    textAlign: "center",
  },
  headphones: {
    width: HEADPHONES_ICON,
    height: HEADPHONES_ICON,
  },
});
