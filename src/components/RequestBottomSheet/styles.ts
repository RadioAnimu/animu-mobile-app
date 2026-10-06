import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { hardShadow } from "@/theme/shape";

const COVER = scale(76);

export const styles = StyleSheet.create({
  replyForm: { gap: THEME.SPACE.LG },
  scrollContent: {
    gap: THEME.SPACE.LG,
    paddingHorizontal: THEME.SPACE.LG,
    paddingTop: THEME.SPACE.SM,
  },
  trackRow: {
    flexDirection: "row",
    gap: THEME.SPACE.LG,
    alignItems: "center",
  },
  // Cover stuck on like a sticker: framed, tilted, with a hard shadow.
  cover: {
    width: COVER,
    height: COVER,
    borderRadius: THEME.RADIUS.LG,
    borderWidth: THEME.BORDER_WIDTH.THICK,
    borderColor: THEME.COLORS.FRAME,
    transform: [{ rotate: "-4deg" }],
    ...hardShadow(THEME.COLORS.BG_DEEP, 4),
  },
  trackInfo: {
    flex: 1,
    gap: THEME.SPACE.XS,
  },
  songName: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD + scale(3),
  },
  animeChip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: THEME.SPACE.XXS,
    borderRadius: THEME.RADIUS.SM,
    backgroundColor: THEME.COLORS.BRAND,
  },
  animeText: {
    color: THEME.COLORS.SURFACE,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  artistText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
