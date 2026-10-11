import type { Dict } from "@/i18n";
import { interpolate } from "@/utils/format";

/** Local midnight of a "YYYY-MM-DD" day key. */
export const dayKeyToDate = (dayKey: string): Date => {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Short localized date for a day key ("Oct 7", "7 Out", "10月7日"), with the
 * year appended only when it is not the current one.
 */
export const formatDayKey = (
  dayKey: string,
  dict: Pick<Dict, "STATS_DATE" | "STATS_MONTHS">,
): string => {
  const date = dayKeyToDate(dayKey);
  const label = interpolate(dict.STATS_DATE, {
    m: dict.STATS_MONTHS[date.getMonth()],
    d: date.getDate(),
  });
  return date.getFullYear() === new Date().getFullYear()
    ? label
    : `${label} ${date.getFullYear()}`;
};
