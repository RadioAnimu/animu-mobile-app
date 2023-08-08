import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    width: Dimensions.get("window").width,
    backgroundColor: "#270052",
    marginBottom: 9,
  },
  info: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    overflow: "hidden",
    marginLeft: 14,
    gap: -3.823,
  },
  title: {
    color: THEME.COLORS.SHAPE,
    fontSize: THEME.FONT_SIZE.LG,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textAlign: "left",
    marginTop: 7,
  },
  song: {
    color: THEME.COLORS.WHITE_TEXT,
    fontSize: THEME.FONT_SIZE.MD,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
  },
  artist: {
    color: THEME.COLORS.WHITE_TEXT,
    fontSize: THEME.FONT_SIZE.MD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
