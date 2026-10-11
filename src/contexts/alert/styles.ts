import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { CONTINUOUS } from "@/theme/shape";

/** Haruka's artwork band at the top of the dialog. */
const IMG_HEIGHT = scale(140);

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.COLORS.SCRIM,
  },
  content: {
    width: THEME.LAYOUT.COMPACT_WIDTH,
    maxWidth: "90%",
    backgroundColor: THEME.COLORS.SURFACE,
    alignItems: "center",
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    padding: THEME.SPACE.LG,
  },
  closeIcon: {
    alignSelf: "flex-end",
  },
  img: {
    height: IMG_HEIGHT,
    width: "100%",
    borderRadius: THEME.RADIUS.MD,
    marginBottom: THEME.SPACE.XL,
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
    marginBottom: THEME.SPACE.XL,
    width: "85%",
  },
  okButton: {
    alignSelf: "stretch",
  },
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: THEME.Z_INDEX.TOAST,
  },
});
