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

/** Minutes → human listening duration: "3h 24m", "45m", "2d 5h". */
export function formatListenDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "0m";
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  if (hours < 24) {
    const rest = total % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restH = hours % 24;
  return restH > 0 ? `${days}d ${restH}h` : `${days}d`;
}
