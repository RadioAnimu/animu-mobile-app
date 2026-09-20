import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const styles = StyleSheet.create({
  fieldLabel: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    marginBottom: THEME.SPACE.XS,
    marginTop: THEME.SPACE.MD,
  },
  input: {
    height: scale(48),
    paddingHorizontal: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: THEME.COLORS.INPUT_BORDER,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
