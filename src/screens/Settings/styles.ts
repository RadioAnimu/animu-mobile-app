import { StyleSheet } from "react-native";

import { THEME } from "@/theme";

const CARD_RADIUS = THEME.RADIUS.CARD;
const CONTENT_PADDING = THEME.SPACE.LG;

export const SWITCH = {
  TRACK_WIDTH: 50,
  TRACK_HEIGHT: 30,
  THUMB: 24,
  PADDING: 3,
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  // 88% column like Account — keeps groups off the screen edges so the
  // content breathes.
  appContainer: {
    flexGrow: 1,
    width: THEME.LAYOUT.CONTENT_WIDTH,
    maxWidth: THEME.LAYOUT.CONTENT_MAX_WIDTH,
    paddingTop: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.XXXL,
    alignSelf: "center",
  },
  // Borderless surface card, identical to Account's groups — the hairline
  // dividers inside carry the separation, a box outline around the whole
  // group just adds noise.
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: CONTENT_PADDING,
  },
  accountRow: {
    paddingVertical: CONTENT_PADDING,
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
    gap: THEME.SPACE.XS,
    marginLeft: CONTENT_PADDING,
    paddingRight: CONTENT_PADDING,
  },
  accountNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
  },
  accountName: {
    flexShrink: 1,
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
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  accountCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
  },
  rowDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  switchDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  rowLabel: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    paddingRight: CONTENT_PADDING,
  },
  // With a supporting line: generous vertical padding so the two lines breathe.
  rowBody: {
    flex: 1,
    justifyContent: "center",
    gap: THEME.SPACE.XS,
    paddingVertical: THEME.SPACE.MD,
    paddingRight: CONTENT_PADDING,
  },
  // Single-label rows: no extra vertical padding, so the label and the
  // switch sit dead-center on the row instead of the label drifting up.
  rowBodySingle: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
    paddingRight: CONTENT_PADDING,
  },
  rowDescription: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
  },
  // Reset demoted to a plain row — a destructive action that's rarely the
  // reason someone opens Settings shouldn't shout from a filled banner.
  resetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
    gap: THEME.SPACE.SM,
  },
  resetRowDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  resetLabel: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: THEME.SPACE.XS,
  },
  rowValueText: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  switchTrack: {
    width: SWITCH.TRACK_WIDTH,
    height: SWITCH.TRACK_HEIGHT,
    borderRadius: SWITCH.TRACK_HEIGHT / 2,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.COLORS.HAIRLINE_SOFT,
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
    marginTop: THEME.SPACE.XXXL,
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
