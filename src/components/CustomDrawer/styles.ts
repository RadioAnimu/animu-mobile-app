import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const ICON_BOX_WIDTH = 32;

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
    width: "100%",
    resizeMode: "contain",
  },
  bottom: {
    marginTop: "auto",
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: THEME.COLORS.HAIRLINE,
    paddingBottom: THEME.SPACE.LG,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 2,
    borderColor: THEME.COLORS.BRAND,
    backgroundColor: THEME.COLORS.APP_BG,
  },
  accountIconBox: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    marginLeft: THEME.SPACE.MD,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
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
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
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
});
