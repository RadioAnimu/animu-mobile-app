import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { hardShadow } from "@/theme/shape";

const FIELD_HEIGHT = THEME.LAYOUT.BUTTON_HEIGHT;
const MULTILINE_HEIGHT = scale(80);
const CLEAR_SIZE = THEME.LAYOUT.TOUCH_TARGET;
const BORDER = THEME.BORDER_WIDTH.THICK;

export const styles = StyleSheet.create({
  wrapper: {
    gap: THEME.SPACE.XS,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: THEME.SPACE.SM,
  },
  // The label is a folder tab fused to the field: same fill as the field's
  // outline, so focus (green) and error (red) light up both together.
  tab: {
    flexShrink: 1,
    marginBottom: -BORDER,
    paddingHorizontal: THEME.SPACE.MD,
    paddingTop: THEME.SPACE.XS,
    paddingBottom: THEME.SPACE.XS + BORDER,
    borderTopLeftRadius: THEME.RADIUS.MD,
    borderTopRightRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.FRAME,
  },
  tabFocused: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  tabError: {
    backgroundColor: THEME.COLORS.ERROR,
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  labelOnLight: {
    color: THEME.COLORS.SURFACE,
  },
  optional: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    opacity: THEME.OPACITY.SOFT,
  },
  counter: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  counterFull: {
    color: THEME.COLORS.ERROR,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.LG,
    borderTopLeftRadius: 0,
    borderWidth: BORDER,
    borderColor: THEME.COLORS.FRAME,
    backgroundColor: THEME.COLORS.TEXT,
    ...hardShadow(),
  },
  fieldMultiline: {
    alignItems: "flex-start",
    minHeight: MULTILINE_HEIGHT,
    paddingVertical: THEME.SPACE.SM,
  },
  fieldFocused: {
    borderColor: THEME.COLORS.BRAND,
  },
  fieldError: {
    borderColor: THEME.COLORS.ERROR,
  },
  fieldDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  input: {
    flex: 1,
    padding: 0,
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    includeFontPadding: false,
  },
  inputMultiline: {
    alignSelf: "stretch",
    textAlignVertical: "top",
  },
  clear: {
    width: CLEAR_SIZE,
    height: CLEAR_SIZE,
    borderRadius: THEME.RADIUS.CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
    marginTop: THEME.SPACE.XS,
  },
  errorText: {
    flex: 1,
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
});
