import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { CONTINUOUS } from "@/theme/shape";

export const styles = StyleSheet.create({
  /** The website player's green stream pill. */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XXS,
    paddingLeft: THEME.SPACE.MD,
    paddingRight: THEME.SPACE.SM,
    paddingVertical: THEME.SPACE.XS,
    backgroundColor: THEME.COLORS.BRAND,
    borderRadius: THEME.RADIUS.MD,
    ...CONTINUOUS,
  },
  pillText: {
    color: THEME.COLORS.SURFACE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  /** The options, floating under the pill: the Settings dropdown's rows. */
  list: {
    position: "absolute",
    minWidth: scale(200),
    paddingVertical: THEME.SPACE.XXS,
    backgroundColor: THEME.COLORS.SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    borderRadius: THEME.RADIUS.LG,
    ...CONTINUOUS,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginHorizontal: THEME.SPACE.MD,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: THEME.SPACE.LG,
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.LG,
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
});
