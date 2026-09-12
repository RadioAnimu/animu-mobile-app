import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const SHEET_INSET = 24;

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SHEET_INSET,
    paddingBottom: THEME.SPACE.XXL,
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    textAlign: "center",
    marginBottom: THEME.SPACE.MD,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    minHeight: 56,
    paddingHorizontal: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
  },
  optionText: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    marginTop: THEME.SPACE.SM,
  },
  cancelText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
