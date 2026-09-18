import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const HEADER_HEIGHT = 72;
const HEADER_BUTTON = 44;
const CARD_RADIUS = 14;

export { HEADER_HEIGHT };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  header: {
    height: HEADER_HEIGHT,
    width: "100%",
    backgroundColor: THEME.COLORS.SURFACE,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
  },
  headerButton: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  appContainer: {
    flexGrow: 1,
    width: "85%",
    paddingBottom: THEME.SPACE.XXXL,
    alignSelf: "center",
  },
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: CARD_RADIUS,
  },
  deviceCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    marginTop: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XS,
  },
});
