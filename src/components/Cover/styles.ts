import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const SIZE = 240;
const FRAME_BORDER = 5;

export const styles = StyleSheet.create({
  image: {
    width: SIZE,
    height: SIZE,
    borderRadius: THEME.RADIUS.XL,
    borderColor: THEME.COLORS.FRAME,
    borderWidth: FRAME_BORDER,
  },
});
