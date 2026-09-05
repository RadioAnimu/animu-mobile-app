import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const ICON_BOX_WIDTH = 32;
const TEXT_MUTED = "rgba(255, 255, 255, 0.7)";

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
    marginTop: 12,
  },
  logoButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  logo: {
    height: 90,
    width: "100%",
    resizeMode: "contain",
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.COLORS.COVER,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
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
    marginRight: -8,
  },
  loginButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    paddingHorizontal: 12,
    marginTop: 18,
    marginBottom: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.15)",
  },
  sectionText: {
    flex: 1,
    color: TEXT_MUTED,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
    letterSpacing: 1.2,
    marginLeft: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  navItemFocused: {
    backgroundColor: "rgba(107, 219, 0, 0.15)",
  },
  navItemText: {
    flex: 1,
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: 16,
    marginLeft: 8,
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  footerText: {
    color: TEXT_MUTED,
    textAlign: "center",
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.FOOTER,
  },
  footerAuthor: {
    textDecorationLine: "underline",
  },
});
