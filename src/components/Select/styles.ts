import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const ROW_MIN_HEIGHT = 52;
const OPTION_MIN_HEIGHT = 48;

/**
 * Row visuals mirror the Settings/Storage group rows so a dropdown reads as
 * the same control language; the unfolded options sit on the quieter surface
 * to signal they belong to the row above.
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
  options: {
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: OPTION_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.LG,
    gap: THEME.SPACE.MD,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.COLORS.HAIRLINE,
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    gap: THEME.SPACE.XXS,
  },
  optionLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  optionLabelSelected: {
    color: THEME.COLORS.BRAND,
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
