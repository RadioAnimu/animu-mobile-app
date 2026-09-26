import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { SCREEN_STYLES } from "@/theme/screen";

export const HEAT_CELL = 10;
export const HEAT_GAP = 2;
export const HEAT_WEEKS = 26;

/** Heat intensity steps — brand green from a whisper to full. */
export const HEAT_LEVELS = [
  "rgba(255, 255, 255, 0.06)",
  "rgba(107, 219, 0, 0.25)",
  "rgba(107, 219, 0, 0.45)",
  "rgba(107, 219, 0, 0.7)",
  THEME.COLORS.BRAND,
] as const;

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  content: SCREEN_STYLES.content,
  group: SCREEN_STYLES.group,
  cardPadding: {
    padding: THEME.SPACE.LG,
  },
  hint: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    marginTop: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.LG,
  },
  detailGap: {
    marginTop: THEME.SPACE.XL,
  },
  afterCardGap: {
    marginTop: THEME.SPACE.XXL,
  },
  overview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME.SPACE.XL,
    padding: THEME.SPACE.LG,
  },
  statItem: {
    gap: THEME.SPACE.XXS,
    minWidth: "28%",
  },
  statLabel: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  statValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  // ── Heatmap ──
  heatScroll: {
    flexGrow: 0,
  },
  heatGrid: {
    padding: THEME.SPACE.MD,
  },
  heatMonthRow: {
    flexDirection: "row",
    // Align with the week columns: grid padding + the weekday-letter column
    // (icon box + gap) that the labels must clear.
    marginLeft: THEME.SPACE.MD + THEME.SPACE.MD + THEME.SPACE.XXS,
    marginBottom: THEME.SPACE.XXS,
    height: THEME.FONT_SIZE.CAPTION,
  },
  heatMonthLabel: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    position: "absolute",
  },
  heatBodyRow: {
    flexDirection: "row",
  },
  heatDowColumn: {
    width: THEME.SPACE.MD,
    justifyContent: "space-between",
    marginRight: THEME.SPACE.XXS,
  },
  heatDowLabel: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: HEAT_CELL,
  },
  heatWeek: {
    gap: HEAT_GAP,
    marginRight: HEAT_GAP,
  },
  heatCell: {
    width: HEAT_CELL,
    height: HEAT_CELL,
    borderRadius: 2,
  },
  heatCellSelected: {
    borderWidth: 1,
    borderColor: THEME.COLORS.TEXT,
  },
  heatLegend: {
    alignItems: "center",
    flexDirection: "row",
    gap: THEME.SPACE.XS,
    justifyContent: "flex-end",
    paddingHorizontal: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.MD,
  },
  heatLegendLabel: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  heatLegendCell: {
    width: HEAT_CELL,
    height: HEAT_CELL,
    borderRadius: 2,
  },
  // ── Streak / detail rows ──
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: THEME.SPACE.LG,
  },
  rowLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  rowValue: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  divider: {
    backgroundColor: THEME.COLORS.HAIRLINE,
    height: StyleSheet.hairlineWidth,
    marginLeft: THEME.SPACE.LG,
  },
  dayTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME.SPACE.XL,
    paddingBottom: THEME.SPACE.MD,
  },
  // ── Profile bars ──
  profileGroup: {
    flexDirection: "column",
    gap: THEME.SPACE.LG,
    padding: THEME.SPACE.LG,
  },
  profileCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    marginBottom: THEME.SPACE.XS,
  },
  barsRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: THEME.SPACE.XXS,
    height: 72,
  },
  bar: {
    backgroundColor: "rgba(107, 219, 0, 0.35)",
    borderRadius: 2,
    flex: 1,
    minHeight: 2,
  },
  barPeak: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  barsLabels: {
    flexDirection: "row",
    gap: THEME.SPACE.XXS,
    marginTop: THEME.SPACE.XXS,
  },
  barLabel: {
    color: THEME.COLORS.TEXT_DIM,
    flex: 1,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: scale(10),
    textAlign: "center",
  },
  emptyText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    padding: THEME.SPACE.LG,
    textAlign: "center",
  },
  emptyTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    paddingBottom: THEME.SPACE.SM,
    textAlign: "center",
  },
  emptyCard: {
    alignItems: "center",
    padding: THEME.SPACE.XL,
  },
  footnote: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: THEME.LINE_HEIGHT.BODY,
    paddingHorizontal: THEME.SPACE.LG,
    textAlign: "center",
  },
  // ── Share card ──
  // Content-driven height with an explicit row rhythm (gap between rows) —
  // no minHeight/stretch, so the card is exactly as tall as its rows.
  shareCard: {
    borderRadius: THEME.RADIUS.CARD,
    overflow: "hidden",
  },
  shareCardBanner: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  shareCardScrim: {
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
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: scale(2),
    borderColor: THEME.COLORS.BRAND,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  shareCardNames: {
    flex: 1,
    gap: THEME.SPACE.XXS,
  },
  shareCardName: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    textShadowRadius: scale(6),
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
  },
  shareCardHandle: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  shareCardStats: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: THEME.SPACE.XL,
  },
  shareCardStat: {
    gap: THEME.SPACE.XXS,
  },
  shareCardStatLabel: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  shareCardStatValue: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
    textShadowRadius: scale(6),
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
  },
  shareCardStatDivider: {
    alignSelf: "stretch",
    width: StyleSheet.hairlineWidth,
    marginBottom: THEME.SPACE.XXS,
    opacity: 0.5,
  },
  shareCardFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
  },
  shareCardRequests: {
    gap: THEME.SPACE.XS,
  },
  shareCardCoverRow: {
    flexDirection: "row",
    gap: THEME.SPACE.XS,
  },
  // Square thumbs stacked like a deck — each one tucks under the previous
  // (newest on top); `contentFit: "cover"` crops any artwork ratio to 1:1.
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
  shareCardLogo: {
    height: scale(30),
    marginBottom: THEME.SPACE.XXS,
    width: scale(104),
  },
  shareActions: {
    flexDirection: "row",
    gap: THEME.SPACE.MD,
    marginTop: THEME.SPACE.MD,
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
  cardActionButton: {
    alignItems: "center",
    backgroundColor: THEME.COLORS.SCRIM,
    borderRadius: THEME.RADIUS.CIRCLE,
    height: scale(40),
    justifyContent: "center",
    width: scale(40),
  },
  cardActionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  shareActionButton: {
    alignItems: "center",
    backgroundColor: THEME.COLORS.BRAND,
    borderRadius: 999,
    flexDirection: "row",
    flex: 1,
    gap: THEME.SPACE.SM,
    justifyContent: "center",
    minHeight: scale(44),
    paddingHorizontal: THEME.SPACE.LG,
  },
  shareActionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  shareActionLabel: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
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
});
