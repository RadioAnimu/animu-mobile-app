import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const ROW_MIN_HEIGHT = 52;
const THUMB = 44;
const ROW_THUMB = 28;

/**
 * The control row and its unfolded options share the exact row metrics the
 * Settings/Storage groups use (52 tall, 12 horizontal padding, 16 bold label
 * / soft value). The list reads as more rows of the same card — only the
 * inset hairline separators and the flipping chevron mark it as expanded.
 */
export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.MD,
  },
  label: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    paddingRight: THEME.SPACE.MD,
  },
  value: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: THEME.SPACE.XS,
  },
  valueText: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "right",
  },
  rowThumb: {
    width: ROW_THUMB,
    height: ROW_THUMB,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: THEME.SPACE.MD,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
    gap: THEME.SPACE.MD,
  },
  optionThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THEME.RADIUS.LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    gap: THEME.SPACE.XXS,
  },
  optionLabel: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  optionLabelSelected: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  optionMeta: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
