import { describe, expect, it, vi } from "vitest";

import type { ListenDay } from "@/core/services/listen-stats.service";
import { captureSize } from "@/screens/Stats/capture";
import { formatDayKey } from "@/screens/Stats/dates";
import { buildWeeks, fitGrid, levelOf } from "@/screens/Stats/heatmap-grid";
import {
  buildHourBars,
  buildWeekdayBars,
  formatHour,
  peakIndex,
} from "@/screens/Stats/profile";
import {
  HEAT_DOW_GAP,
  HEAT_DOW_WIDTH,
  HEAT_GAP,
  HEAT_MAX_WEEKS,
  HEAT_MIN_CELL,
  HEAT_MIN_WEEKS,
} from "@/screens/Stats/styles";

// vi.mock is hoisted above the imports; `scale()` needs Dimensions.
vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

const day = (ms: number, hours: Partial<Record<number, number>> = {}): ListenDay => ({
  ms,
  sessions: 0,
  tracks: 0,
  requests: 0,
  submitted: 0,
  shouts: 0,
  firstAt: null,
  lastAt: null,
  hours: Array.from({ length: 24 }, (_, h) => hours[h] ?? 0),
});

const dict = {
  STATS_DATE: "{m} {d}",
  STATS_MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  STATS_DOW: ["S", "M", "T", "W", "T", "F", "S"],
};

describe("fitGrid", () => {
  it("fills the width: weeks of at least the minimum cell, edge to edge", () => {
    const width = 340;
    const { weeks, cell } = fitGrid(width);
    expect(cell).toBeGreaterThanOrEqual(HEAT_MIN_CELL);
    const used = HEAT_DOW_WIDTH + HEAT_DOW_GAP + weeks * cell + (weeks - 1) * HEAT_GAP;
    expect(used).toBeLessThanOrEqual(width);
    // Less than one cell of slack — no dead band on the right.
    expect(width - used).toBeLessThan(1);
  });

  it("clamps the week count on very narrow and very wide cards", () => {
    expect(fitGrid(0).weeks).toBe(HEAT_MIN_WEEKS);
    expect(fitGrid(5000).weeks).toBe(HEAT_MAX_WEEKS);
  });
});

describe("buildWeeks", () => {
  // Wednesday 7 Oct 2026.
  const now = "2026-10-07";

  it("ends with the current Sun→Sat week and hides days after today", () => {
    const { columns } = buildWeeks(4, {}, now);
    expect(columns).toHaveLength(4);
    const last = columns[3];
    expect(last.map((c) => c.key)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    expect(last.map((c) => c.future)).toEqual([false, false, false, false, true, true, true]);
    expect(columns[0][0].key).toBe("2026-09-13");
  });

  it("reads each day's listening from the stats", () => {
    const { columns } = buildWeeks(1, { "2026-10-06": day(42) }, now);
    expect(columns[0][2].ms).toBe(42);
    expect(columns[0][1].ms).toBe(0);
  });

  it("labels month starts and drops a cramped partial first month", () => {
    // Columns start 13, 20, 27 Sep and 4 Oct: three columns apart is room.
    const { months } = buildWeeks(4, {}, now);
    expect(months).toEqual([
      { index: 0, month: 8 },
      { index: 3, month: 9 },
    ]);
    // Two columns: Sep at 0 and Oct at 1 are too close — the partial goes.
    expect(buildWeeks(2, {}, now).months).toEqual([{ index: 1, month: 9 }]);
  });
});

describe("levelOf", () => {
  it("steps through the five heat levels", () => {
    expect([0, 59_999, 60_000, 15 * 60_000, 45 * 60_000, 90 * 60_000].map(levelOf)).toEqual([
      0, 0, 1, 2, 3, 4,
    ]);
  });
});

describe("profile bars", () => {
  it("sums hours across days and finds the first tallest bar", () => {
    const bars = buildHourBars([day(0, { 1: 10, 5: 30 }), day(0, { 5: 5, 9: 35 })]);
    expect(bars[5].value).toBe(35);
    expect(bars[9].value).toBe(35);
    expect(peakIndex(bars)).toBe(5);
  });

  it("has no peak for an all-zero series", () => {
    expect(peakIndex(buildHourBars([]))).toBe(-1);
  });

  it("buckets days by local weekday, Sunday first", () => {
    // 4 Oct 2026 is a Sunday, 7 Oct a Wednesday.
    const bars = buildWeekdayBars({ "2026-10-04": day(5), "2026-10-07": day(9) }, dict);
    expect(bars.map((b) => b.value)).toEqual([5, 0, 0, 9, 0, 0, 0]);
    expect(peakIndex(bars)).toBe(3);
  });

  it("formats the peak hour as a 24h clock time", () => {
    expect(formatHour(1)).toBe("01:00");
    expect(formatHour(18)).toBe("18:00");
  });
});

describe("formatDayKey", () => {
  it("uses the localized pattern and adds the year only for past years", () => {
    const year = new Date().getFullYear();
    expect(formatDayKey(`${year}-10-07`, dict)).toBe("Oct 7");
    expect(formatDayKey(`${year - 1}-01-02`, dict)).toBe(`Jan 2 ${year - 1}`);
    expect(formatDayKey(`${year}-10-07`, { ...dict, STATS_DATE: "{m}{d}日" })).toBe("Oct7日");
  });
});

describe("captureSize", () => {
  it("asks Android for pixels and iOS for points, both ≥1080px wide", () => {
    // 360pt card at 3x: native is already 1080px.
    expect(captureSize(360, 240, 3, "android")).toEqual({ width: 1080, height: 720 });
    expect(captureSize(360, 240, 3, "ios")).toEqual({ width: 360, height: 240 });
    // Low density upscales to the floor instead of shrinking the share.
    expect(captureSize(360, 240, 2, "android")).toEqual({ width: 1080, height: 720 });
    expect(captureSize(360, 240, 2, "ios")).toEqual({ width: 540, height: 360 });
  });

  it("never downscales below the screen's own density", () => {
    expect(captureSize(400, 300, 3.5, "android")).toEqual({ width: 1400, height: 1050 });
  });
});
