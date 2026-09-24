import { StyleSheet } from "react-native";

import { THEME } from "@/theme";

/**
 * Shared page scaffold for the settings-style screens (Settings, Storage,
 * About, Account, Login): the full-bleed deep background, the centered
 * content column with the one-gap-under-header inset, and the borderless
 * surface "group" card the rows live inside — the hairline dividers inside
 * carry the separation, a box outline would only add noise.
 */
export const SCREEN_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  content: {
    flexGrow: 1,
    width: THEME.LAYOUT.CONTENT_WIDTH,
    maxWidth: THEME.LAYOUT.CONTENT_MAX_WIDTH,
    alignSelf: "center",
    // The first section drops its own top margin, so this inset is the one
    // gap under the header on every page.
    paddingTop: THEME.SPACE.XXL,
    paddingBottom: THEME.SPACE.XXXL,
  },
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: THEME.RADIUS.CARD,
    overflow: "hidden",
  },
});

/**
 * Flow screens (MakeRequest, History): a plain full-height container, a
 * centered 85% content column, and the full-width flex wrapper the
 * scrollable results render into.
 */
export const FLOW_STYLES = StyleSheet.create({
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
  listWrapper: {
    width: "100%",
    flex: 1,
  },
});

/**
 * The row rhythm shared by every settings-style screen (Settings, Account,
 * Select, About, AccountEmails, the drawer): a fixed-minimum-height row with
 * the same leading icon column, so a row icon sits on the exact same x as
 * the section heading icon above it and rows line up on one vertical grid
 * across all screens that compose them. The vertical air comes from the
 * row body (or the min height when the row is a single line).
 */
export const ROW_STYLES = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.LG,
  },
  iconBox: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  caption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  description: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: THEME.SPACE.LG,
  },
});
