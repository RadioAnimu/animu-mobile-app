import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  appContainer: SCREEN_STYLES.content,
  group: SCREEN_STYLES.group,
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
    overflow: "hidden",
    flexDirection: "row",
  },
  /** Everything on the device that is NOT this app's cover cache. */
  deviceBarOther: {
    height: "100%",
    backgroundColor: THEME.COLORS.TEXT_DIM,
  },
  /** The app's cached-covers share — the propagated purple so the bar and
      the caption below it read as one story. */
  deviceBarCached: {
    height: "100%",
    backgroundColor: THEME.COLORS.VISUALIZER,
  },
  deviceCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginTop: THEME.SPACE.SM,
    // Sits on the same grid as the rows above it.
    paddingHorizontal: THEME.SPACE.LG,
  },
  deviceCachedCaption: {
    color: THEME.COLORS.VISUALIZER,
  },
});
