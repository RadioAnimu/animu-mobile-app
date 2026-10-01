import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const AVATAR = scale(52);
// Face box of success_haruka.webp (1000×620): x 125–485, y 110–470. Absolute
// children are positioned from the padding edge, inside the border.
const CROP = 360;
const INNER = AVATAR - 2 * THEME.BORDER_WIDTH.THICK;
const FACE_SCALE = INNER / CROP;

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: THEME.SPACE.MD,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: THEME.BORDER_WIDTH.THICK,
    borderColor: THEME.COLORS.BRAND,
    backgroundColor: THEME.COLORS.FRAME,
    overflow: "hidden",
  },
  face: {
    position: "absolute",
    width: 1000 * FACE_SCALE,
    height: 620 * FACE_SCALE,
    left: -125 * FACE_SCALE,
    top: -110 * FACE_SCALE,
  },
  bubble: {
    flex: 1,
    padding: THEME.SPACE.MD,
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
  },
});
