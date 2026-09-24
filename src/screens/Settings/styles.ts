import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

export const SWITCH = {
  TRACK_WIDTH: scale(50),
  TRACK_HEIGHT: scale(30),
  THUMB: scale(24),
  PADDING: scale(3),
};

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  appContainer: SCREEN_STYLES.content,
  group: SCREEN_STYLES.group,
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: CONTENT_PADDING,
  },
  accountRow: {
    paddingVertical: CONTENT_PADDING,
  },
  accountAvatar: {
    width: scale(56),
    height: scale(56),
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: scale(2),
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
  // Fixed leading-icon column shared with Account's rows, so every settings
  // row lines up on the same vertical grid as the section headings above it.
  rowIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
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
});
