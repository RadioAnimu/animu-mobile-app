import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const FONINHO = 20;

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
  foninho: {
    width: FONINHO,
    height: FONINHO,
    objectFit: "contain",
  },
});
