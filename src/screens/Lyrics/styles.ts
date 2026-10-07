import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

/** Lyric text: large, bold, left-aligned — the Apple Music read. */
export const LYRIC = {
  SIZE: scale(32),
  LINE_HEIGHT: scale(40),
  LABEL_SIZE: scale(18),
  LABEL_LINE_HEIGHT: scale(23),
  /** Space between lines. */
  GAP: scale(26),
  /** Where the active line's top sits, as a share of the lyrics viewport. */
  ANCHOR: 0.3,
  /** Rows fade out over this distance at the viewport's top / bottom edge. */
  EDGE_FADE: scale(72),
  DOT: scale(11),
};

const lineText = {
  fontFamily: THEME.FONT_FAMILY.BOLD,
  fontSize: LYRIC.SIZE,
  lineHeight: LYRIC.LINE_HEIGHT,
  color: THEME.COLORS.TEXT,
  letterSpacing: -0.3,
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  grabberHit: {
    alignSelf: "center",
    paddingVertical: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XL,
  },
  grabber: {
    width: scale(38),
    height: scale(5),
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.LG,
    paddingHorizontal: THEME.SPACE.XXL,
    paddingTop: THEME.SPACE.SM,
    paddingBottom: THEME.SPACE.LG,
  },
  thumbnail: {
    width: scale(64),
    height: scale(64),
    borderRadius: THEME.RADIUS.MD,
    borderWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    color: THEME.COLORS.TEXT,
  },
  artist: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    color: THEME.COLORS.TEXT_SOFT,
  },
  roundButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonOn: {
    backgroundColor: THEME.COLORS.TEXT,
  },
  pronunciationGlyph: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    color: THEME.COLORS.TEXT,
  },
  pronunciationGlyphOn: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
  },
  body: {
    flex: 1,
    overflow: "hidden",
  },
  column: {
    paddingHorizontal: THEME.SPACE.XXL,
  },
  row: {
    paddingBottom: LYRIC.GAP,
  },
  lineText,
  readerLine: {
    ...lineText,
    paddingBottom: LYRIC.GAP,
  },
  readerLineDim: {
    ...lineText,
    paddingBottom: LYRIC.GAP,
    opacity: 0.6,
  },
  label: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: LYRIC.LABEL_SIZE,
    lineHeight: LYRIC.LABEL_LINE_HEIGHT,
    color: THEME.COLORS.TEXT,
    opacity: 0.92,
    marginTop: THEME.SPACE.XXS,
  },
  words: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  wordDim: {
    opacity: 0.35,
  },
  wordFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    overflow: "hidden",
  },
  dots: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: scale(8),
    height: LYRIC.LINE_HEIGHT,
    alignItems: "center",
    transformOrigin: "left center",
  },
  dot: {
    width: LYRIC.DOT,
    height: LYRIC.DOT,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.TEXT,
  },
  plainLine: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: scale(22),
    lineHeight: scale(30),
    color: THEME.COLORS.TEXT,
    opacity: 0.85,
  },
  plainContent: {
    paddingTop: THEME.SPACE.SM,
    paddingBottom: THEME.SPACE.XXXL + THEME.SPACE.LG,
  },
  plainRow: {
    marginBottom: THEME.SPACE.XS + 2,
  },

  stanzaGap: {
    height: LYRIC.GAP,
  },
  footer: {
    paddingTop: THEME.SPACE.XL,
    gap: THEME.SPACE.XS,
  },
  footerText: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    color: THEME.COLORS.TEXT_SOFT,
  },
  notice: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    color: THEME.COLORS.TEXT_SOFT,
    marginBottom: THEME.SPACE.LG,
  },
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: THEME.SPACE.XXXL,
    gap: THEME.SPACE.MD,
  },
  messageTitle: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
    color: THEME.COLORS.TEXT,
    textAlign: "center",
  },
  messageHint: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    color: THEME.COLORS.TEXT_SOFT,
    textAlign: "center",
  },
  pill: {
    marginTop: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XL,
    paddingVertical: THEME.SPACE.SM + 2,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.TEXT,
  },
  pillText: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    color: THEME.COLORS.TEXT_ON_LIGHT,
  },
  prompt: {
    marginHorizontal: THEME.SPACE.XL,
    marginBottom: THEME.SPACE.MD,
    padding: THEME.SPACE.LG,
    borderRadius: THEME.RADIUS.CARD,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    gap: THEME.SPACE.XS,
  },
  promptTitle: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    color: THEME.COLORS.TEXT,
  },
  promptText: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    lineHeight: THEME.LINE_HEIGHT.BODY,
    color: THEME.COLORS.TEXT_SOFT,
  },
  promptButton: {
    marginTop: 0,
  },
  promptButtonBusy: {
    opacity: THEME.OPACITY.DISABLED,
  },
  promptActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: THEME.SPACE.SM,
  },
});
