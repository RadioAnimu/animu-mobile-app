import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  // Same 88% column and insets as Settings/Account/About.
  appContainer: {
    flexGrow: 1,
    width: THEME.LAYOUT.CONTENT_WIDTH,
    maxWidth: THEME.LAYOUT.CONTENT_MAX_WIDTH,
    paddingTop: THEME.SPACE.XXL,
    paddingBottom: THEME.SPACE.XXXL,
    alignSelf: "center",
  },
  // Borderless surface card, identical to Settings' groups — the hairline
  // dividers inside carry the separation.
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: THEME.RADIUS.CARD,
    overflow: "hidden",
  },
  deviceBarTrack: {
    height: scale(4),
    borderRadius: 999,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginHorizontal: THEME.SPACE.LG,
    marginTop: THEME.SPACE.MD,
    overflow: "hidden",
  },
  deviceBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: THEME.COLORS.TEXT_DIM,
  },
  deviceCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginTop: THEME.SPACE.SM,
    // Sits on the same grid as the rows above it.
    paddingHorizontal: THEME.SPACE.LG,
  },
});
