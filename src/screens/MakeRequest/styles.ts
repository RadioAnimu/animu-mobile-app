import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const INPUT_HEIGHT = scale(44);
const FIELD_ICON = scale(22);

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "85%",
    marginBottom: THEME.SPACE.LG,
    alignSelf: "center",
  },
  logoWrapper: {
    marginVertical: THEME.SPACE.LG,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: THEME.SPACE.LG,
  },
  listWrapper: {
    width: "100%",
    flex: 1,
  },
  list: {
    flexGrow: 1,
    gap: THEME.SPACE.MD,
  },
  input: {
    height: INPUT_HEIGHT,
    width: "100%",
    borderRadius: THEME.RADIUS.MD,
    borderWidth: scale(2),
    borderColor: THEME.COLORS.INPUT_BORDER,
    backgroundColor: THEME.COLORS.INPUT_BG,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "left",
    textAlignVertical: "center",
    includeFontPadding: false,
    paddingLeft: THEME.SPACE.LG,
    paddingVertical: 0,
    // Reserves the in-field icon slot so text never runs under it.
    paddingRight: FIELD_ICON + THEME.SPACE.LG,
  },
  // Relative anchor for the in-field icon slot (magnifier ↔ clear).
  searchField: {
    flex: 1,
    justifyContent: "center",
  },
  fieldIcon: {
    position: "absolute",
    right: THEME.SPACE.SM,
    top: (INPUT_HEIGHT - FIELD_ICON) / 2,
    width: FIELD_ICON,
    height: FIELD_ICON,
    borderRadius: THEME.RADIUS.CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: THEME.SPACE.MD,
    width: "100%",
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderRadius: THEME.RADIUS.MD,
    padding: THEME.SPACE.MD,
    marginBottom: THEME.SPACE.MD,
  },
  errorText: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  retryButton: {
    backgroundColor: THEME.COLORS.BRAND,
    borderRadius: THEME.RADIUS.SM,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.XS,
  },
  retryText: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  emptyText: {
    color: THEME.COLORS.TEXT,
    textAlign: "center",
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    marginTop: THEME.SPACE.LG,
  },
  minHint: {
    width: "100%",
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    marginTop: -THEME.SPACE.SM,
    marginBottom: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.XS,
  },
  recent: {
    width: "100%",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XS,
  },
  recentTitle: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  recentClear: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.XS,
  },
  recentText: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  loadMoreSpinner: {
    margin: THEME.SPACE.MD,
  },
});
