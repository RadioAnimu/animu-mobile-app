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
  // Same field recipe as the app's inputs: INPUT_BG with the deeper
  // INPUT_BORDER and the shared MD radius.
  box: {
    flex: 1,
    maxWidth: BOX_MAX,
    aspectRatio: 1,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: THEME.COLORS.INPUT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  // The box being typed: the brand hue on the same border.
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
  // Transparent text (not `opacity: 0`, which would drop the field from the
  // accessibility tree on both platforms) keeps the node readable to
  // screen readers while the boxes carry the visuals.
  input: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Android's TextInput ignores the alpha channel of `color` (transparent
    // text still paints opaque black), so the field is hidden with an
    // imperceptible opacity instead. Kept just above zero — `opacity: 0`
    // drops the node from the accessibility tree on both platforms — and the
    // boxes carry every visual.
    opacity: THEME.OPACITY.INVISIBLE,
    backgroundColor: "transparent",
    padding: 0,
  },
});
