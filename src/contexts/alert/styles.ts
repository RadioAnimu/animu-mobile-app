import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const CONTENT_WIDTH = 311;
const IMG_HEIGHT = 140;
const PORTAL_Z_INDEX = 9999;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.COLORS.SCRIM,
    zIndex: PORTAL_Z_INDEX,
  },
  content: {
    width: CONTENT_WIDTH,
    backgroundColor: THEME.COLORS.SURFACE,
    alignItems: "center",
    borderRadius: THEME.RADIUS.MD,
    padding: THEME.SPACE.SM,
  },
  closeIcon: {
    alignSelf: "flex-end",
  },
  img: {
    height: IMG_HEIGHT,
    width: "100%",
    borderRadius: THEME.RADIUS.MD,
    resizeMode: "contain",
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
    backgroundColor: THEME.COLORS.BRAND,
    padding: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
  },
  okText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: PORTAL_Z_INDEX,
  },
});
