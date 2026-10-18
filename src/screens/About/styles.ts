import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES, ROW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  appContainer: SCREEN_STYLES.content,
  header: {
    alignItems: "center",
    gap: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.XXL,
  },
  appName: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
  },
  headerVersion: ROW_STYLES.caption,
  group: SCREEN_STYLES.group,
  groupSpaced: {
    ...SCREEN_STYLES.group,
    marginTop: THEME.SPACE.XXL,
  },
  // Non-interactive discloser / social link rows (shared row body otherwise).
  row: ROW_STYLES.row,
  // Trailing value of a read-only row; wraps instead of truncating.
  rowValue: {
    flexShrink: 1,
    marginLeft: THEME.SPACE.MD,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.BODY,
    textAlign: "right",
  },
  rowValueStacked: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.BODY,
  },
  // Intro / explanatory paragraph.
  paragraph: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.SM,
  },
  // Donor row.
  donor: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: THEME.SPACE.SM,
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.SM,
  },
  donorName: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  donorNote: {
    ...ROW_STYLES.caption,
    paddingRight: CONTENT_PADDING,
  },
  // Footer block of the page (copyright etc.).
  footer: {
    alignItems: "center",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.XXXL,
    paddingTop: THEME.SPACE.XL,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.COLORS.HAIRLINE,
  },
  footerLine: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: THEME.LINE_HEIGHT.CAPTION,
    textAlign: "center",
  },
  badge: {
    width: scale(88),
    height: scale(31),
  },
});
