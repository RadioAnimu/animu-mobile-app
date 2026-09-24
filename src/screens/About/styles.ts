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
  // Read-only key/value row (no chevron, no press).
  row: ROW_STYLES.row,
  rowIcon: ROW_STYLES.iconBox,
  rowLabel: {
    ...ROW_STYLES.label,
    flex: 1,
  },
  rowValue: {
    flexShrink: 1,
    marginLeft: THEME.SPACE.MD,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "right",
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
    flexShrink: 1,
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
    lineHeight: THEME.LINE_HEIGHT.BODY,
    textAlign: "center",
  },
  footerLink: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textDecorationLine: "underline",
  },
  badge: {
    width: scale(88),
    height: scale(31),
  },
});
