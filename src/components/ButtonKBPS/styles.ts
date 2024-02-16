import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: 41,
    width: 91,
    borderRadius: 6,
    marginBottom: 10,
  },
  kbps: {
    fontSize: THEME.FONT_SIZE.BITRATE_LABEL,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  category: {
    fontSize: THEME.FONT_SIZE.BITRATE_BTNS,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
