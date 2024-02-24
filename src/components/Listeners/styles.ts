import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
    marginBottom: 10,
  },
  text: {
    fontSize: THEME.FONT_SIZE.MD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    verticalAlign: "middle",
    textAlign: "center",
  },
  foninho: {
    width: 20,
    height: 20,
    objectFit: "contain",
  },
});
