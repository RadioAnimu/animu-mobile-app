import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

// Big enough to actually judge a quality tier at a glance (the old 52 read
// as a tiny swatch). The option row grows around it.
const THUMB = scale(76);

/**
 * The control row shares the Settings group's row rhythm (64px, breathing
 * body) so a Select sits flush beside the toggle rows. The current value is
 * a soft pill (no hard border) and the unfolded options are a plain tonal
 * panel — not a bordered box — so the whole thing reads as one surface
 * instead of squares nested in squares.
 */
export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.LG,
  },
  body: {
    flex: 1,
    gap: THEME.SPACE.XS,
    paddingVertical: THEME.SPACE.MD,
    paddingRight: THEME.SPACE.LG,
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  description: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
  },
  // A pill, not a bordered square: rounded fully, tone-on-tone, no outline.
  value: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: THEME.SPACE.XXS,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderRadius: THEME.RADIUS.CIRCLE,
  },
  valueText: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "right",
  },
  // Tonal panel, no border — the surrounding card's dividers do the work.
  optionsContainer: {
    marginHorizontal: THEME.SPACE.MD,
    marginBottom: THEME.SPACE.MD,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderRadius: THEME.RADIUS.LG,
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
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    gap: THEME.SPACE.MD,
  },
  optionThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THEME.RADIUS.MD,
    borderWidth: scale(1.5),
    borderColor: THEME.COLORS.HAIRLINE,
    backgroundColor: THEME.COLORS.SURFACE,
  },
  optionThumbSelected: {
    borderColor: THEME.COLORS.BRAND,
    borderWidth: scale(2),
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    gap: THEME.SPACE.XXS,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: THEME.SPACE.XS,
  },
  optionLabel: {
    flexShrink: 1,
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
    lineHeight: THEME.LINE_HEIGHT.BODY,
  },
  badge: {
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: scale(2),
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.BRAND_SUBTLE,
  },
  badgeText: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
