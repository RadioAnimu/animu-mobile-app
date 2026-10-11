import type { ListenDay } from "@/core/services/listen-stats.service";
import { dayKeyOf } from "@/core/services/listen-stats.service";
import { dayKeyToDate } from "@/screens/Stats/dates";
import {
  HEAT_DOW_GAP,
  HEAT_DOW_WIDTH,
  HEAT_GAP,
  HEAT_MAX_WEEKS,
  HEAT_MIN_CELL,
  HEAT_MIN_WEEKS,
} from "@/screens/Stats/styles";

/** One heatmap day. */
export interface Cell {
  key: string;
  future: boolean;
  ms: number;
}

/** Heat level for a day's listening: 0 (none) … 4 (90m+). */
export const levelOf = (ms: number): number => {
  if (ms < 60_000) return 0;
  if (ms < 15 * 60_000) return 1;
  if (ms < 45 * 60_000) return 2;
  if (ms < 90 * 60_000) return 3;
  return 4;
};

/**
 * Week columns and cell size that fill `width`: as many weeks as fit at the
 * minimum cell size (bounded), then the cells grow to take the slack — the
 * grid always spans the card edge to edge, no scrolling, no dead band.
 */
export const fitGrid = (
  width: number,
): { weeks: number; cell: number } => {
  const avail = width - HEAT_DOW_WIDTH - HEAT_DOW_GAP;
  const fit = Math.floor((avail + HEAT_GAP) / (HEAT_MIN_CELL + HEAT_GAP));
  const weeks = Math.max(HEAT_MIN_WEEKS, Math.min(HEAT_MAX_WEEKS, fit));
  const cell = Math.floor(((avail - (weeks - 1) * HEAT_GAP) / weeks) * 10) / 10;
  return { weeks, cell };
};

/**
 * Calendar columns (Sun → Sat) for the last `weeks` weeks ending with the
 * week of `todayKey`,
 * plus a month label on each column where a new month starts. The first
 * column is only labelled when the next label is far enough away not to
 * collide with it.
 */
export const buildWeeks = (
  weeks: number,
  days: Record<string, ListenDay>,
  todayKey: string,
): { columns: Cell[][]; months: { index: number; month: number }[] } => {
  const today = dayKeyToDate(todayKey);
  // Calendar arithmetic (not raw 24h steps) so DST never skips a day.
  const firstDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - today.getDay() - (weeks - 1) * 7,
  );
  const columns: Cell[][] = [];
  const months: { index: number; month: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const column: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(
        firstDay.getFullYear(),
        firstDay.getMonth(),
        firstDay.getDate() + w * 7 + d,
      );
      const key = dayKeyOf(date.getTime());
      column.push({ key, future: key > todayKey, ms: days[key]?.ms ?? 0 });
    }
    columns.push(column);
    const month = dayKeyToDate(column[0].key).getMonth();
    const prev = w > 0 ? dayKeyToDate(columns[w - 1][0].key).getMonth() : -1;
    if (month !== prev) months.push({ index: w, month });
  }
  // A partial first month directly followed by a new one would overlap.
  if (months.length > 1 && months[1].index - months[0].index < 3) {
    months.shift();
  }
  return { columns, months };
};
