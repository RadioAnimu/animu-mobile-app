import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const BTN_WIDTH = scale(91);
const BTN_HEIGHT = scale(41);

export const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    // A floor, not a fixed height: larger text grows the pill instead of
    // clipping the format line.
    minHeight: BTN_HEIGHT,
    paddingVertical: THEME.SPACE.XXS,
    // Likewise a floor for the width: "320 kbps" at a large text size grows
    // the pill (the row scrolls) instead of wrapping inside it.
    minWidth: BTN_WIDTH,
    paddingHorizontal: THEME.SPACE.SM,
    borderRadius: THEME.RADIUS.SM,
    marginBottom: THEME.SPACE.SM,
  },
  kbps: {
    fontSize: THEME.FONT_SIZE.LIST,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  category: {
    fontSize: THEME.FONT_SIZE.LABEL,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
