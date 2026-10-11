import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const SIZE = scale(240);
const FRAME_BORDER = scale(5);

export const styles = StyleSheet.create({
  /**
   * At least the old square, with the cover centered in it: short art no
   * longer pulls the screen up, tall art grows the slot.
   */
  slot: {
    width: SIZE,
    minHeight: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: SIZE,
    height: SIZE,
    borderRadius: THEME.RADIUS.XL,
    borderColor: THEME.COLORS.FRAME,
    borderWidth: FRAME_BORDER,
  },
});
