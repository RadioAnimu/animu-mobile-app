import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const AVATAR = 50;

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: THEME.SPACE.MD,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 2,
    borderColor: THEME.COLORS.BRAND,
  },
  info: {
    flexDirection: "column",
    gap: THEME.SPACE.XS,
  },
  username: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
  },
});
