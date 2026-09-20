import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const SIZE = scale(240);
const FRAME_BORDER = scale(5);

export const styles = StyleSheet.create({
  image: {
    width: SIZE,
    height: SIZE,
    borderRadius: THEME.RADIUS.XL,
    borderColor: THEME.COLORS.FRAME,
    borderWidth: FRAME_BORDER,
  },
});
