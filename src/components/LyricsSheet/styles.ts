import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const ROW_GAP = 18;
const LINE_SIZE = 20;
const ACTIVE_LINE_SIZE = 23;
const ROMAJI_SIZE = 13;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: THEME.SPACE.LG,
    paddingBottom: THEME.SPACE.MD,
    gap: THEME.SPACE.MD,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnail: {
    width: 46,
    height: 46,
    borderRadius: THEME.RADIUS.MD,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    color: THEME.COLORS.TEXT,
  },
  trackArtist: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    color: THEME.COLORS.TEXT_SOFT,
  },
  romajiToggle: {
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.XS + 2,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
  },
  romajiToggleOn: {
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderColor: THEME.COLORS.BRAND,
  },
  romajiToggleLabel: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    color: THEME.COLORS.TEXT_SOFT,
  },
  romajiToggleLabelOn: {
    color: THEME.COLORS.BRAND,
  },
  body: {
    flex: 1,
  },
  listContent: {
    // Vertical paddings come from the window height (half-viewport) so the
    // first/last line can center under the follow effect — see listPaddings.
    paddingHorizontal: THEME.SPACE.XL,
  },
  row: {
    marginBottom: ROW_GAP,
  },
  lineActive: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: ACTIVE_LINE_SIZE,
    lineHeight: ACTIVE_LINE_SIZE * 1.35,
    color: THEME.COLORS.TEXT,
    textShadowColor: "rgba(0, 0, 0, 0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  wordSung: {
    color: THEME.COLORS.TEXT,
  },
  wordUpcoming: {
    color: "rgba(255, 255, 255, 0.42)",
  },
  lineFuture: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: LINE_SIZE,
    lineHeight: LINE_SIZE * 1.4,
    color: "rgba(255, 255, 255, 0.55)",
  },
  linePast: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: LINE_SIZE,
    lineHeight: LINE_SIZE * 1.4,
    color: "rgba(255, 255, 255, 0.28)",
  },
  linePlain: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: LINE_SIZE,
    lineHeight: LINE_SIZE * 1.45,
    color: THEME.COLORS.TEXT_SOFT,
  },
  romajiActive: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: ROMAJI_SIZE,
    lineHeight: ROMAJI_SIZE * 1.3,
    color: THEME.COLORS.BRAND,
    marginBottom: 3,
  },
  romajiStatic: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: ROMAJI_SIZE,
    lineHeight: ROMAJI_SIZE * 1.3,
    color: "rgba(255, 255, 255, 0.35)",
    marginBottom: 2,
  },
  stateContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: THEME.SPACE.XXL,
    gap: THEME.SPACE.MD,
  },
  stateMessage: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    color: THEME.COLORS.TEXT,
    textAlign: "center",
  },
  stateHint: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    color: THEME.COLORS.TEXT_SOFT,
    textAlign: "center",
  },
  retryButton: {
    marginTop: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XL,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.BRAND,
  },
  retryLabel: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    color: THEME.COLORS.TEXT_ON_LIGHT,
  },
});
