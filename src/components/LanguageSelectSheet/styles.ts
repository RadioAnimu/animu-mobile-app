import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const ROW_MIN_HEIGHT = 52;

export const styles = StyleSheet.create({
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
    textAlign: "center",
    marginTop: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.LG,
  },
  searchInput: {
    color: THEME.COLORS.TEXT,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderRadius: THEME.RADIUS.MD,
    paddingVertical: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.MD,
    marginHorizontal: THEME.SPACE.XL,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  list: {
    marginTop: THEME.SPACE.SM,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.XL,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  langName: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  langNameSelected: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  emptyText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
    paddingVertical: THEME.SPACE.XXL,
  },
});
