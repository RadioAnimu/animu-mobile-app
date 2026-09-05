import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const INPUT_HEIGHT = 40;
const SEARCH_ICON = 37;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "85%",
    marginBottom: THEME.SPACE.LG,
    alignSelf: "center",
  },
  logoWrapper: {
    marginVertical: THEME.SPACE.LG,
  },
  inputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: THEME.RADIUS.XL,
    marginBottom: THEME.SPACE.LG,
  },
  listWrapper: {
    width: "100%",
    flex: 1,
  },
  list: {
    flexGrow: 1,
    gap: THEME.SPACE.MD,
  },
  input: {
    flex: 1,
    height: INPUT_HEIGHT,
    borderRadius: THEME.RADIUS.SM,
    borderWidth: 3,
    borderColor: THEME.COLORS.INPUT_BORDER,
    backgroundColor: THEME.COLORS.INPUT_BG,
    color: THEME.COLORS.TEXT,
    textAlign: "left",
    paddingLeft: THEME.SPACE.MD,
    marginRight: THEME.SPACE.MD,
  },
  searchIcon: {
    height: SEARCH_ICON,
    width: SEARCH_ICON,
    borderRadius: THEME.RADIUS.SM,
    backgroundColor: THEME.COLORS.INPUT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreBtn: {
    backgroundColor: THEME.COLORS.INPUT_BG,
    padding: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.LG,
    margin: THEME.SPACE.MD,
  },
  loadMoreText: {
    color: THEME.COLORS.TEXT,
    textAlign: "center",
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
