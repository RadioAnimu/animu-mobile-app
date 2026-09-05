import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const IMAGE = 50;

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: THEME.SPACE.XS,
    padding: THEME.SPACE.XS,
    minWidth: "100%",
  },
  image: {
    width: IMAGE,
    height: IMAGE,
    borderColor: THEME.COLORS.FRAME,
    borderWidth: 1,
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    flex: 1,
  },
});
