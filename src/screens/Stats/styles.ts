import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
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
    marginLeft: THEME.SPACE.MD,
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
    fontSize: THEME.FONT_SIZE.CAPTION,
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
});
