/** Listening-stats dictionary subset used by the duration/streak formatters. */
import type { Dict } from "@/i18n";

const KB = 1024;
/** Byte size of one megabyte — shared by the storage/limit UIs. */
export const MB = KB * 1024;
const GB = MB * 1024;

/** Human-friendly size: B / KB / MB / GB, one decimal under 10 units. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < KB) return `${Math.round(bytes)} B`;
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  if (bytes < GB) return `${trimUnit(bytes / MB)} MB`;
  return `${trimUnit(bytes / GB)} GB`;
}

function trimUnit(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

/** Whole-percent share of `part` in `whole`, clamped to 0–100. */
export function percentOf(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  const ratio = (part / whole) * 100;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

/** Fills `{placeholder}` tokens in a localized string. */
export function interpolate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in variables ? String(variables[key]) : match,
  );
}

/** Localized duration units, as surfaced by the listening-stats screens. */
export interface ListenDurationUnits {
  days: string;
  hours: string;
  minutes: string;
}

/** The localized unit set for `formatListenDuration` from a dictionary. */
export function listenDurationUnits(
  dict: Pick<
    Dict,
    "STATS_UNIT_DAYS" | "STATS_UNIT_HOURS" | "STATS_UNIT_MINUTES"
  >,
): ListenDurationUnits {
  return {
    days: dict.STATS_UNIT_DAYS,
    hours: dict.STATS_UNIT_HOURS,
    minutes: dict.STATS_UNIT_MINUTES,
  };
}

/**
 * Minutes → human listening duration: "3h 24m", "45m", "2d 5h".
 * Pass `listenDurationUnits(dict)` for the user's language (Japanese gets
 * "3時間 24分" instead of English letters).
 */
export function formatListenDuration(
  minutes: number,
  units?: ListenDurationUnits,
): string {
  const u = units ?? { days: "d", hours: "h", minutes: "m" };
  if (!Number.isFinite(minutes) || minutes < 1) return `0${u.minutes}`;
  const total = Math.round(minutes);
  if (total < 60) return `${total}${u.minutes}`;
  const hours = Math.floor(total / 60);
  if (hours < 24) {
    const rest = total % 60;
    return rest > 0
      ? `${hours}${u.hours} ${rest}${u.minutes}`
      : `${hours}${u.hours}`;
  }
  const days = Math.floor(hours / 24);
  const restH = hours % 24;
  return restH > 0
    ? `${days}${u.days} ${restH}${u.hours}`
    : `${days}${u.days}`;
}

/** Localized "N days / 1 day" streak label, shared by the stats surfaces. */
export function formatStreakLabel(
  days: number,
  dict: Pick<Dict, "STATS_STREAK_DAY" | "STATS_STREAK_DAYS">,
): string {
  return days === 1
    ? dict.STATS_STREAK_DAY
    : interpolate(dict.STATS_STREAK_DAYS, { n: days });
}
// speed probe 1790704407
