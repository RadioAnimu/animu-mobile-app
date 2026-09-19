import { StyleSheet } from "react-native";
import { THEME } from "@/theme";

const SHEET_INSET = 24;

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SHEET_INSET,
    paddingBottom: THEME.SPACE.XXL,
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
    textAlign: "center",
  },
  subtitle: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
    marginTop: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.SM,
    lineHeight: 19,
  },
  fieldLabel: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    marginBottom: THEME.SPACE.XS,
    marginTop: THEME.SPACE.MD,
  },
  input: {
    height: 48,
    paddingHorizontal: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: THEME.COLORS.INPUT_BORDER,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  error: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginTop: THEME.SPACE.MD,
    textAlign: "center",
  },
  submit: {
    height: 52,
    marginTop: THEME.SPACE.XL,
    borderRadius: 14,
    backgroundColor: THEME.COLORS.BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  submitText: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  loading: {
    marginTop: THEME.SPACE.XL,
  },
  list: {
    marginTop: THEME.SPACE.MD,
    gap: THEME.SPACE.SM,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: THEME.SPACE.SM,
    padding: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: THEME.COLORS.INPUT_BORDER,
  },
  rowBody: {
    flex: 1,
    gap: THEME.SPACE.XS,
  },
  rowEmail: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  rowMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME.SPACE.XS,
  },
  badge: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: 2,
    borderRadius: THEME.RADIUS.SM,
    backgroundColor: THEME.COLORS.INPUT_BORDER,
    overflow: "hidden",
  },
  badgeVerified: {
    color: THEME.COLORS.BRAND,
  },
  badgePending: {
    color: THEME.COLORS.TEXT_DIM,
  },
  removeButton: {
    paddingVertical: THEME.SPACE.XS,
    paddingHorizontal: THEME.SPACE.SM,
  },
  removeText: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  empty: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
    marginTop: THEME.SPACE.MD,
  },
  cancel: {
    height: 44,
    marginTop: THEME.SPACE.SM,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
});
