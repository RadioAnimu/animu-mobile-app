import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { SCREEN_STYLES } from "@/theme/screen";
import { CONTINUOUS, avatarRadius } from "@/theme/shape";

/** Smallest heatmap cell — the grid shows as many weeks as fit at this size. */
export const HEAT_MIN_CELL = scale(14);
export const HEAT_GAP = scale(3);
/** Bounds on the week columns the heatmap shows (≈2 – 6 months). */
export const HEAT_MIN_WEEKS = 8;
export const HEAT_MAX_WEEKS = 26;
/** Weekday-letter column left of the grid, and its gap to the first week. */
export const HEAT_DOW_WIDTH = scale(16);
export const HEAT_DOW_GAP = THEME.SPACE.XS;

/**
 * Heat intensity steps on the SURFACE card: an empty step lifted just off
 * the surface, then one green hue from deep to full brand. Opaque, so the
 * mid steps stay green — translucent brand over violet mixes to olive grey.
 */
export const HEAT_LEVELS = [
  "#3A1667",
  "#1F4D1C",
  "#2F7A12",
  "#4FAE06",
  THEME.COLORS.BRAND,
] as const;

/** Plain bars of the profile/day histograms; the peak gets full brand. */
const BAR_COLOR = HEAT_LEVELS[2];
const BARS_HEIGHT = scale(64);

/**
 * Share card logo box, at the logo canvas' own 1200×630 ratio: the visible
 * art comes out ≈70pt wide — a touch over the first card's, still a
 * signature rather than a headline.
 */
const SHARE_LOGO_H = scale(46);
const SHARE_LOGO_W = SHARE_LOGO_H * (1200 / 630);

const caption = {
  color: THEME.COLORS.TEXT_DIM,
  fontFamily: THEME.FONT_FAMILY.REGULAR,
  fontSize: THEME.FONT_SIZE.CAPTION,
} as const;

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  content: SCREEN_STYLES.content,
  group: SCREEN_STYLES.group,
  divider: {
    backgroundColor: THEME.COLORS.HAIRLINE,
    height: StyleSheet.hairlineWidth,
  },
  caption,

  // ── Sign-in state notice ──
  notice: {
    alignItems: "flex-start",
    borderColor: THEME.COLORS.HAIRLINE_SOFT,
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    borderWidth: 1,
    flexDirection: "row",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.MD,
    padding: THEME.SPACE.MD,
  },
  noticeText: {
    color: THEME.COLORS.TEXT_SOFT,
    flex: 1,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    lineHeight: THEME.LINE_HEIGHT.CAPTION,
  },

  // ── Overview ──
  hero: {
    gap: THEME.SPACE.XXS,
    padding: THEME.SPACE.LG,
  },
  heroValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: scale(34),
  },
  heroMeta: {
    ...caption,
    color: THEME.COLORS.TEXT_SOFT,
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.SM,
  },
  // Two per row: half the row minus half the gap between them.
  tile: {
    ...SCREEN_STYLES.group,
    flexBasis: "48%",
    flexGrow: 1,
    gap: THEME.SPACE.XS,
    padding: THEME.SPACE.MD,
  },
  tileValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
  },
  tileLabel: caption,

  // ── Top songs / anime ──
  topEmpty: {
    padding: THEME.SPACE.LG,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.LG,
    paddingVertical: THEME.SPACE.SM,
  },
  topDivider: {
    backgroundColor: THEME.COLORS.HAIRLINE,
    height: StyleSheet.hairlineWidth,
    // Inset to the text column: rank + cover + their gaps.
    marginLeft: THEME.SPACE.LG + scale(18) + scale(44) + THEME.SPACE.MD * 2,
  },
  topRank: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
    width: scale(18),
  },
  topRankFirst: {
    color: THEME.COLORS.BRAND,
  },
  topCover: {
    alignItems: "center",
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderRadius: THEME.RADIUS.SM,
    ...CONTINUOUS,
    height: scale(44),
    justifyContent: "center",
    overflow: "hidden",
    width: scale(44),
  },
  topCoverImage: {
    height: "100%",
    width: "100%",
  },
  topText: {
    flex: 1,
    gap: THEME.SPACE.XXS,
  },
  topTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  topPlays: {
    ...caption,
    color: THEME.COLORS.TEXT_SOFT,
  },

  // ── Heatmap ──
  heatCard: {
    gap: THEME.SPACE.SM,
    padding: THEME.SPACE.LG,
  },
  heatMonthRow: {
    height: THEME.LINE_HEIGHT.CAPTION,
    marginLeft: HEAT_DOW_WIDTH + HEAT_DOW_GAP,
  },
  heatMonthLabel: {
    ...caption,
    position: "absolute",
    top: 0,
  },
  heatBodyRow: {
    flexDirection: "row",
    gap: HEAT_DOW_GAP,
  },
  heatDowColumn: {
    gap: HEAT_GAP,
    width: HEAT_DOW_WIDTH,
  },
  heatDowLabel: {
    ...caption,
    fontSize: scale(10),
    textAlign: "left",
  },
  heatWeeks: {
    flexDirection: "row",
    gap: HEAT_GAP,
  },
  heatWeek: {
    gap: HEAT_GAP,
  },
  heatCell: {
    borderRadius: THEME.RADIUS.XS + 1,
  },
  heatCellToday: {
    borderColor: THEME.COLORS.TEXT_DIM,
    borderWidth: 1,
  },
  heatCellSelected: {
    borderColor: THEME.COLORS.TEXT,
    borderWidth: 2,
  },
  heatFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: THEME.SPACE.SM,
    justifyContent: "space-between",
  },
  heatLegend: {
    alignItems: "center",
    flexDirection: "row",
    gap: THEME.SPACE.XXS,
  },
  heatLegendCell: {
    borderRadius: THEME.RADIUS.XS,
    height: scale(10),
    width: scale(10),
  },

  // ── Day detail ──
  dayDetail: {
    gap: THEME.SPACE.MD,
    padding: THEME.SPACE.LG,
  },
  dayHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: THEME.SPACE.SM,
  },
  dayTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: THEME.SPACE.MD,
  },
  dayStat: {
    gap: THEME.SPACE.XXS,
    paddingRight: THEME.SPACE.SM,
    width: "33.33%",
  },
  dayStatValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },

  // ── Profile bars ──
  profileGroup: {
    gap: THEME.SPACE.XL,
    padding: THEME.SPACE.LG,
  },
  profileBlock: {
    gap: THEME.SPACE.SM,
  },
  profileHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: THEME.SPACE.SM,
    justifyContent: "space-between",
  },
  profilePeak: {
    color: THEME.COLORS.BRAND,
    flexShrink: 1,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    textAlign: "right",
  },
  barsRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: scale(3),
    height: BARS_HEIGHT,
  },
  bar: {
    backgroundColor: BAR_COLOR,
    // Rounded data end, square baseline.
    borderTopLeftRadius: THEME.RADIUS.XS,
    borderTopRightRadius: THEME.RADIUS.XS,
    flex: 1,
  },
  barEmpty: {
    backgroundColor: THEME.COLORS.HAIRLINE_SOFT,
  },
  barPeak: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  barsBaseline: {
    backgroundColor: THEME.COLORS.HAIRLINE,
    height: StyleSheet.hairlineWidth,
  },
  barsLabels: {
    flexDirection: "row",
    gap: scale(3),
  },
  barLabel: {
    ...caption,
    flex: 1,
    fontSize: scale(10),
    textAlign: "center",
  },
  // Hour axis: a label every 6 hours, anchored at its bar's left edge so
  // "0" sits under midnight instead of floating between bars.
  barLabelHour: {
    ...caption,
    fontSize: scale(10),
    position: "absolute",
    top: 0,
  },
  hourAxis: {
    height: THEME.LINE_HEIGHT.CAPTION,
  },

  // ── Empty state ──
  emptyCard: {
    alignItems: "center",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.XXL,
    padding: THEME.SPACE.XL,
  },
  emptyTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
  },
  emptyText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    textAlign: "center",
  },

  // ── Share card ──
  // Content-driven height with an explicit row rhythm (gap between rows) —
  // no minHeight/stretch, so the card is exactly as tall as its rows.
  shareCard: {
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    overflow: "hidden",
  },
  shareCardFill: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  shareCardContent: {
    flexDirection: "column",
    gap: THEME.SPACE.MD,
    padding: THEME.SPACE.LG,
  },
  shareCardIdentity: {
    alignItems: "center",
    flexDirection: "row",
    gap: THEME.SPACE.MD,
  },
  shareCardAvatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: avatarRadius(scale(48)),
    ...CONTINUOUS,
    borderWidth: scale(2),
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  shareCardNames: {
    flex: 1,
    gap: THEME.SPACE.XXS,
  },
  shareCardName: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
  },
  shareCardHandle: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  shareCardStats: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: THEME.SPACE.LG,
  },
  shareCardStat: {
    flexShrink: 1,
    gap: THEME.SPACE.XXS,
  },
  shareCardLabel: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  shareCardStatValue: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
  },
  shareCardStatDivider: {
    alignSelf: "stretch",
    width: StyleSheet.hairlineWidth,
    marginBottom: THEME.SPACE.XXS,
  },
  shareCardFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: THEME.SPACE.MD,
  },
  shareCardRequests: {
    flexShrink: 1,
    gap: THEME.SPACE.XS,
  },
  shareCardCoverRow: {
    flexDirection: "row",
  },
  // Square thumbs stacked like a deck — each one tucks under the previous
  // (most-requested on top); `contentFit: "cover"` crops any artwork to 1:1.
  shareCardCover: {
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: THEME.RADIUS.SM,
    borderWidth: 1.5,
    height: scale(42),
    width: scale(42),
  },
  shareCardCoverOverlap: {
    marginLeft: -scale(12),
  },
  // Logo over the station address, pinned bottom-right; the address is
  // centred under the art.
  shareCardSignature: {
    alignItems: "center",
    gap: THEME.SPACE.XXS,
    marginLeft: "auto",
  },
  // The logo PNG is a 1200×630 canvas with transparent margins around the
  // art (≈11% left, 10% right, 10% top, 15% bottom). The box keeps that
  // ratio and the negative margins trim the empty canvas on every side, so
  // the signature column is exactly as wide as the visible art — the art
  // sits flush right and the address centres on the art itself.
  shareCardLogoWrap: {
    height: SHARE_LOGO_H,
    marginBottom: -SHARE_LOGO_H * 0.15,
    marginLeft: -SHARE_LOGO_W * 0.11,
    marginRight: -SHARE_LOGO_W * 0.1,
    marginTop: -SHARE_LOGO_H * 0.1,
    width: SHARE_LOGO_W,
  },
  // Dark blurred copy of the logo PNG behind the artwork — alpha-shaped
  // contrast boost instead of a rectangular chip/shadow.
  shareCardLogoShadow: {
    height: SHARE_LOGO_H,
    left: 0,
    position: "absolute",
    top: scale(1),
    width: SHARE_LOGO_W,
  },
  shareCardLogo: {
    height: SHARE_LOGO_H,
    width: SHARE_LOGO_W,
  },
  // Narrower than the logo above it — an address line, not a second logo.
  shareCardUrl: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: scale(8),
    letterSpacing: scale(0.4),
  },
  // Floating action buttons over the card's top-right corner (same recipe
  // as the Account profile's floating refresh): scrim circle, white icon.
  // They overlay the card as siblings of the captured view, so they never
  // end up inside the shared image.
  cardActions: {
    flexDirection: "row",
    gap: THEME.SPACE.SM,
    position: "absolute",
    right: THEME.SPACE.MD,
    top: THEME.SPACE.MD,
  },
  // Frosted disc: the button draws a blurred slice of the card behind it
  // (`cardActionFrost`) under a light violet tint and a hairline rim.
  cardActionButton: {
    alignItems: "center",
    backgroundColor: "rgba(22, 1, 53, 0.25)",
    borderColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: StyleSheet.hairlineWidth,
    height: scale(40),
    justifyContent: "center",
    overflow: "hidden",
    width: scale(40),
  },
  cardActionFrost: {
    position: "absolute",
  },
  cardActionTint: {
    backgroundColor: "rgba(22, 1, 53, 0.22)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  cardActionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },

  // ── Signed-out card ──
  lockedCard: {
    alignItems: "center",
    gap: THEME.SPACE.MD,
    padding: THEME.SPACE.XL,
  },
  lockedIconCircle: {
    alignItems: "center",
    backgroundColor: THEME.COLORS.BRAND_SUBTLE,
    borderColor: THEME.COLORS.BRAND,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 1,
    height: scale(56),
    justifyContent: "center",
    width: scale(56),
  },
  lockedText: {
    gap: THEME.SPACE.XS,
  },
  lockedButton: {
    alignSelf: "stretch",
    marginTop: THEME.SPACE.XS,
  },
});
