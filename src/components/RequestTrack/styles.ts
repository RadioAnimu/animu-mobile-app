import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 5,
    padding: 3,
    minWidth: "100%",
  },
  image: {
    width: 50,
    height: 50,
    borderColor: THEME.COLORS.TEXT,
    borderWidth: 1,
  },
  text: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: 16,
    flex: 1,
  },
});
