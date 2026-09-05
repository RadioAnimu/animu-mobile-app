import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const BTN_WIDTH = 91;
const BTN_HEIGHT = 41;

export const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: BTN_HEIGHT,
    width: BTN_WIDTH,
    borderRadius: THEME.RADIUS.SM,
    marginBottom: THEME.SPACE.SM,
  },
  kbps: {
    fontSize: THEME.FONT_SIZE.LIST,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  category: {
    fontSize: THEME.FONT_SIZE.LABEL,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
