import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const CARD_RADIUS = 14;

export const styles = StyleSheet.create({
  card: {
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    rowGap: 10,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  totalMeta: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  barRow: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    gap: 2,
    marginVertical: 2,
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
    minHeight: 28,
    gap: THEME.SPACE.XS,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: THEME.SPACE.XS,
  },
  legendLabel: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  legendMeta: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    fontVariant: ["tabular-nums"],
  },
  cleanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.XS,
    minHeight: 44,
    marginTop: THEME.SPACE.XS,
    borderRadius: CARD_RADIUS - 6,
    backgroundColor: THEME.COLORS.INPUT_BG,
  },
  cleanDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  cleanLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
});
