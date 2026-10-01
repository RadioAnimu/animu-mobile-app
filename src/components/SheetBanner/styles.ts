import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { hardShadow } from "@/theme/shape";

const LIVE_DOT = scale(12);

export const styles = StyleSheet.create({
  wrapper: {
    marginTop: THEME.SPACE.MD,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    paddingVertical: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.LG,
    borderRadius: THEME.RADIUS.LG,
    borderWidth: THEME.BORDER_WIDTH.THICK,
    borderColor: THEME.COLORS.FRAME,
    backgroundColor: THEME.COLORS.BRAND,
    ...hardShadow(),
  },
  liveDot: {
    width: LIVE_DOT,
    height: LIVE_DOT,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.LIVE,
  },
  title: {
    flexShrink: 1,
    color: THEME.COLORS.SURFACE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
    textTransform: "uppercase",
  },
  sticker: {
    position: "absolute",
    top: -scale(16),
    right: scale(8),
  },
});
