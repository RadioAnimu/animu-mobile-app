import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const CARD_RADIUS = 14;
const HEADER_HEIGHT = 72;
const HEADER_BUTTON = 44;
const ROW_MIN_HEIGHT = 52;
const SECTION_ICON_SIZE = 18;
const ICON_BOX_WIDTH = 32;

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
  settingsText: {
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
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.MD,
    marginTop: THEME.SPACE.XL,
    marginBottom: THEME.SPACE.SM,
    paddingBottom: THEME.SPACE.MD,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  iconBox: {
    width: ICON_BOX_WIDTH,
    alignItems: "center",
  },
  sectionText: {
    flex: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    letterSpacing: 1.2,
    marginLeft: THEME.SPACE.SM,
  },
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: CARD_RADIUS,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: THEME.SPACE.MD,
  },
  accountRow: {
    paddingVertical: THEME.SPACE.MD,
  },
  accountAvatar: {
    width: 56,
    height: 56,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 2,
    borderColor: THEME.COLORS.BRAND,
    backgroundColor: THEME.COLORS.APP_BG,
  },
  accountInfo: {
    flex: 1,
    gap: THEME.SPACE.XXS,
    marginLeft: THEME.SPACE.MD,
    paddingRight: THEME.SPACE.MD,
  },
  accountName: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
  },
  accountService: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
  },
  accountServiceIcon: {
    width: ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  accountCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  rowLabelDanger: {
    color: THEME.COLORS.ERROR,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.MD,
  },
  rowLabel: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    paddingRight: THEME.SPACE.MD,
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
  },
  rowValueText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
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
  footer: {
    alignItems: "center",
    marginTop: "auto",
    paddingTop: THEME.SPACE.XXL,
  },
  footerText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    textAlign: "center",
  },
  footerAuthor: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textDecorationLine: "underline",
  },
});

export { SECTION_ICON_SIZE };
