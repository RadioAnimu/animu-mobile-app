import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

/** Widest a box grows; narrower screens let the row shrink instead. */
const BOX_MAX = scale(60);

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
  },
  box: {
    flex: 1,
    maxWidth: BOX_MAX,
    aspectRatio: 1,
    borderRadius: THEME.RADIUS.LG,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: scale(1.5),
    borderColor: THEME.COLORS.INPUT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  boxFocused: {
    borderColor: THEME.COLORS.HAIRLINE,
  },
  boxActive: {
    borderColor: THEME.COLORS.BRAND,
  },
  boxDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  digit: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  caret: {
    width: scale(2),
    height: scale(26),
    borderRadius: scale(1),
    backgroundColor: THEME.COLORS.BRAND,
  },
  // Invisible full-row field on top of the boxes: the OS sees one focusable
  // input (one keyboard, one value) while the digits paint into the boxes.
  input: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: "transparent",
    backgroundColor: "transparent",
    padding: 0,
  },
});
