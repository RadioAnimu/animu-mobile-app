import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BACKGROUND_900,
  },
  header: {
    height: 72,
    width: Dimensions.get("window").width,
    backgroundColor: THEME.COLORS.PRIMARY,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
  },
  settingsText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LG,
  },
  appContainer: {
    flexDirection: "column",
    width: "85%",
    paddingBottom: 15,
    alignSelf: "center",
  },
  titleSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  titleText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LG,
  },
  qualitySectionButtons: {
    flexDirection: "row",
  },
});
