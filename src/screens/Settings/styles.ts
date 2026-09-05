import { Dimensions, StyleSheet } from "react-native";

import { THEME } from "../../theme";

const CARD_RADIUS = 14;
const HEADER_HEIGHT = 72;
const HEADER_BUTTON = 44;
const ROW_MIN_HEIGHT = 52;

export { HEADER_HEIGHT };

export const SWITCH = {
  TRACK_WIDTH: 48,
  TRACK_HEIGHT: 28,
  THUMB: 22,
  PADDING: 3,
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  header: {
    height: HEADER_HEIGHT,
    width: Dimensions.get("window").width,
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
  settingsText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  appContainer: {
    flexDirection: "column",
    width: "85%",
    paddingBottom: 15,
    alignSelf: "center",
  },
  titleSection: {
    marginTop: THEME.SPACE.XXL,
    marginBottom: THEME.SPACE.MD,
  },
  titleText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  splitter: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginTop: THEME.SPACE.XXL,
  },
  card: {
    backgroundColor: THEME.COLORS.FRAME,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profile: {
    flex: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    paddingRight: THEME.SPACE.MD,
  },
  rowsGroup: {
    marginTop: THEME.SPACE.SM,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: ROW_MIN_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  switchTrack: {
    width: SWITCH.TRACK_WIDTH,
    height: SWITCH.TRACK_HEIGHT,
    borderRadius: SWITCH.TRACK_HEIGHT / 2,
    justifyContent: "center",
  },
  switchThumb: {
    width: SWITCH.THUMB,
    height: SWITCH.THUMB,
    borderRadius: SWITCH.THUMB / 2,
    backgroundColor: THEME.COLORS.TEXT,
    position: "absolute",
    left: SWITCH.PADDING,
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowValueText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
