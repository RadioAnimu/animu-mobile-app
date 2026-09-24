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
