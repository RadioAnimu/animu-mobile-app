import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const HEADER_HEIGHT = scale(72);
const HEADER_BUTTON = scale(44);

export { HEADER_HEIGHT };

export const styles = StyleSheet.create({
  // A clean SURFACE bar: arrow + centered title via flex (no absolute
  // positioning, no hairline). `space-around` (not `space-between`) keeps the
  // arrow off the screen edge.
  header: {
    width: "100%",
    backgroundColor: THEME.COLORS.SURFACE,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
  },
  headerButton: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
});
