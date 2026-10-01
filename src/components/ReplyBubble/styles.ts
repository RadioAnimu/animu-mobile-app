import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { hardShadow } from "@/theme/shape";

const AVATAR = scale(44);

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: THEME.SPACE.MD,
  },
  column: {
    flex: 1,
    alignItems: "flex-end",
    gap: THEME.SPACE.XS,
  },
  name: {
    maxWidth: "100%",
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  bubble: {
    alignSelf: "stretch",
    paddingHorizontal: THEME.SPACE.LG,
    paddingVertical: THEME.SPACE.SM,
    ...hardShadow(),
  },
  bubbleFocused: hardShadow(THEME.COLORS.BRAND, 3),
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  input: {
    minHeight: scale(28),
    maxHeight: scale(104),
    padding: 0,
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: THEME.BORDER_WIDTH.THICK,
    borderColor: THEME.COLORS.BRAND,
  },
});
