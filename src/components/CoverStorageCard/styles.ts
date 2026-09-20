import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: THEME.RADIUS.CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    padding: THEME.SPACE.LG,
    gap: THEME.SPACE.MD,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: THEME.SPACE.MD,
  },
  summaryText: {
    flexShrink: 1,
    gap: THEME.SPACE.XXS,
  },
  totalValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  totalLabel: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  totalCount: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  explain: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
  },
  barTrack: {
    flexDirection: "row",
    height: scale(14),
    borderRadius: scale(7),
    overflow: "hidden",
    gap: scale(2),
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  barSegment: {
    height: "100%",
  },
  empty: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  hint: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: scale(26),
    gap: THEME.SPACE.XS,
  },
  dot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    marginRight: THEME.SPACE.XS,
  },
  legendLabel: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  legendValue: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    fontVariant: ["tabular-nums"],
  },
  cleanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    minHeight: scale(48),
    marginTop: THEME.SPACE.XS,
    borderRadius: THEME.RADIUS.XL,
    backgroundColor: THEME.COLORS.BRAND,
  },
  cleanBusy: {
    opacity: THEME.OPACITY.SOFT,
  },
  cleanDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  cleanLabel: {
    color: THEME.COLORS.SURFACE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
