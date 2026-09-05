import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const ICON_BOX_WIDTH = 32;
const LOGO_HEIGHT = 90;
const CARD_RADIUS = 14;

export const DRAWER_GRID = {
  SCREEN_MARGIN: 12,
  CONTENT_INSET: 20,
};

export const styles = StyleSheet.create({
  iconBox: {
    width: ICON_BOX_WIDTH,
    alignItems: "center",
  },
  header: {
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
    marginTop: THEME.SPACE.MD,
  },
  logoButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: THEME.SPACE.SM,
    marginBottom: THEME.SPACE.XS,
  },
  logo: {
    height: LOGO_HEIGHT,
    width: "100%",
    resizeMode: "contain",
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.COLORS.FRAME,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
    marginTop: THEME.SPACE.XS,
  },
  headerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  settingsButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -THEME.SPACE.SM,
  },
  loginButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: THEME.SPACE.SM,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.MD,
    marginTop: 18,
    marginBottom: THEME.SPACE.SM,
    paddingBottom: THEME.SPACE.MD,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  sectionText: {
    flex: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    letterSpacing: 1.2,
    marginLeft: THEME.SPACE.SM,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
  },
  navItemFocused: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  navItemText: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    marginLeft: THEME.SPACE.SM,
  },
  navItemTextFocused: {
    color: THEME.COLORS.SURFACE,
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: THEME.SPACE.LG,
    marginTop: THEME.SPACE.XL,
    paddingHorizontal: THEME.SPACE.XXL,
  },
  footerText: {
    color: THEME.COLORS.TEXT_SOFT,
    textAlign: "center",
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  footerAuthor: {
    textDecorationLine: "underline",
  },
});
