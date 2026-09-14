import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const THUMB = 22;

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: THEME.SPACE.LG,
    paddingTop: THEME.SPACE.SM,
    paddingBottom: THEME.SPACE.MD,
  },
  track: {
    height: THUMB,
    justifyContent: "center",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.BRAND,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 2,
    borderColor: THEME.COLORS.BRAND,
    backgroundColor: THEME.COLORS.SURFACE,
  },
  thumbActive: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  thumbInactive: {
    backgroundColor: THEME.COLORS.SURFACE,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: THEME.SPACE.XS,
    paddingHorizontal: THUMB / 2 - 6,
  },
  label: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    color: THEME.COLORS.TEXT_DIM,
  },
  labelActive: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
