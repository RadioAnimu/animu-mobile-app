import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const PREVIEW = 96;

export const styles = StyleSheet.create({
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
    textAlign: "center",
    marginTop: THEME.SPACE.XS,
  },
  caption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
    marginTop: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.MD,
  },
  list: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: THEME.SPACE.XL,
    paddingVertical: THEME.SPACE.MD,
    gap: THEME.SPACE.MD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  preview: {
    width: PREVIEW,
    height: PREVIEW,
    borderRadius: THEME.RADIUS.XL,
    borderWidth: 2,
    borderColor: THEME.COLORS.FRAME,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  info: {
    flex: 1,
    gap: THEME.SPACE.XS,
  },
  qualityName: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  qualityMeta: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
