import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { FLOW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const INPUT_HEIGHT = THEME.LAYOUT.FIELD_HEIGHT;

export const styles = StyleSheet.create({
  container: FLOW_STYLES.container,
  appContainer: { ...FLOW_STYLES.appContainer, paddingTop: THEME.SPACE.MD },
  logoWrapper: {
    marginVertical: THEME.SPACE.LG,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: THEME.SPACE.LG,
  },
  listWrapper: FLOW_STYLES.listWrapper,
  list: {
    flexGrow: 1,
    gap: THEME.SPACE.MD,
  },
  input: {
    minHeight: INPUT_HEIGHT,
    width: "100%",
    // The app's field recipe (see EmailCodeFields): INPUT_BG, a hairline
    // INPUT_BORDER that turns brand while focused, MD radius.
    borderRadius: THEME.RADIUS.MD,
    borderWidth: THEME.BORDER_WIDTH.OUTLINE,
    borderColor: THEME.COLORS.INPUT_BORDER,
    backgroundColor: THEME.COLORS.INPUT_BG,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "left",
    textAlignVertical: "center",
    includeFontPadding: false,
    paddingLeft: THEME.SPACE.LG,
    paddingVertical: THEME.SPACE.SM,
    // Reserves the in-field icon slot so text never runs under it.
    paddingRight: THEME.LAYOUT.TOUCH_TARGET + THEME.SPACE.SM,
  },
  inputFocused: {
    borderColor: THEME.COLORS.BRAND,
  },
  // Relative anchor for the in-field icon slot (magnifier ↔ clear).
  searchField: {
    flex: 1,
    justifyContent: "center",
  },
  fieldIcon: {
    position: "absolute",
    right: THEME.SPACE.SM,
    top: 0,
    bottom: 0,
    width: THEME.LAYOUT.TOUCH_TARGET,
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
    minHeight: THEME.LAYOUT.TOUCH_TARGET,
    justifyContent: "center",
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
  recentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: THEME.SPACE.XS + THEME.ICON.MD + THEME.SPACE.MD,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: scale(52),
  },
  recentPick: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    alignSelf: "stretch",
    // Same edges as the "Recent / Clear" header above the rows.
    paddingLeft: THEME.SPACE.XS,
  },
  recentRemove: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingLeft: THEME.SPACE.LG,
    paddingRight: THEME.SPACE.XS,
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
