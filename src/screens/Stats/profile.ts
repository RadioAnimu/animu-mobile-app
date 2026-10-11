import type { ListenDay } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { dayKeyToDate } from "@/screens/Stats/dates";
import type { ProfileBar } from "@/screens/Stats/ProfileBars";

/** Per-hour listening summed across `days` — 24 bars, midnight first. */
export const buildHourBars = (days: readonly ListenDay[]): ProfileBar[] =>
  Array.from({ length: 24 }, (_, h) => ({
    id: `hour-${h}`,
    value: days.reduce((sum, d) => sum + d.hours[h], 0),
    label: `${h}`,
  }));

/** Per-weekday listening summed across all recorded days — Sunday first. */
export const buildWeekdayBars = (
  days: Record<string, ListenDay>,
  dict: Pick<Dict, "STATS_DOW">,
): ProfileBar[] => {
  const totals = Array.from({ length: 7 }, () => 0);
  for (const [key, d] of Object.entries(days)) {
    totals[dayKeyToDate(key).getDay()] += d.ms;
  }
  return totals.map((value, wd) => ({
    id: `dow-${wd}`,
    value,
    label: dict.STATS_DOW[wd],
  }));
};

/** "01:00" — the start of a peak hour, in the 24h form every locale reads. */
export const formatHour = (hour: number): string =>
  `${String(hour).padStart(2, "0")}:00`;

/** Index of the tallest bar (first one wins ties), or -1 for an all-zero series. */
export const peakIndex = (bars: readonly ProfileBar[]): number => {
  let peak = -1;
  bars.forEach((bar, i) => {
    if (bar.value > 0 && (peak < 0 || bar.value > bars[peak].value)) peak = i;
  });
  return peak;
};
