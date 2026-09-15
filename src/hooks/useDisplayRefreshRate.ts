import { useEffect, useState } from "react";

/** Common display refresh rates we snap a measured value to. */
const COMMON_RATES = [60, 90, 120, 144, 165];
const FALLBACK_HZ = 60;
/** Total measurement window and warm-up to skip (ms). */
const MEASURE_MS = 1500;
const WARMUP_MS = 300;
/** Below this, assume the display is 60 Hz (throttled / emulator / unknown). */
const MIN_PLAUSIBLE_HZ = 55;

const snap = (measured: number): number => {
  // A low reading means rAF is being throttled (background, emulator, heavy
  // first frame) rather than a genuinely slow display — fall back to 60.
  if (!Number.isFinite(measured) || measured < MIN_PLAUSIBLE_HZ) {
    return FALLBACK_HZ;
  }
  for (const rate of COMMON_RATES) {
    if (Math.abs(measured - rate) <= 10) return rate;
  }
  return Math.round(measured);
};

/**
 * Highest rate the display has demonstrated this session. A display can run
 * slower than its maximum at times (adaptive refresh, throttling, a busy JS
 * thread), so a measurement is treated as a capability that only grows.
 * Otherwise a single low reading permanently hides a supported rate — e.g.
 * the 120 Hz stop vanishing after the user selects 60 Hz for testing.
 */
let maxObservedHz = 0;

/**
 * Estimates the display refresh rate by measuring `requestAnimationFrame`
 * cadence — the actual vsync the app can render at. Snaps to a common rate
 * (60/90/120/144/165); falls back to 60 while measuring / when throttled.
 *
 * Measures once per mount and reports the highest rate seen this session, so
 * the available stops never shrink once a faster mode has been observed.
 */
export function useDisplayRefreshRate(): number {
  const [hz, setHz] = useState(maxObservedHz || FALLBACK_HZ);

  useEffect(() => {
    let frames = 0;
    let measuredStart = 0;
    let first = 0;
    let raf = 0;
    const tick = (timestamp: number) => {
      if (first === 0) first = timestamp;
      // Skip the warm-up window so app startup work doesn't skew the reading.
      if (timestamp - first >= WARMUP_MS) {
        if (measuredStart === 0) measuredStart = timestamp;
        frames += 1;
        const elapsed = timestamp - measuredStart;
        if (elapsed >= MEASURE_MS) {
          const measured = snap((frames / elapsed) * 1000);
          if (measured > maxObservedHz) {
            maxObservedHz = measured;
            setHz(measured);
          }
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return hz;
}

/**
 * Fixed slider stops derived from the display rate: off, half, 80% and vsync.
 * e.g. 60 Hz → [0, 30, 48, 60]; 120 Hz → [0, 60, 96, 120].
 */
export function buildHzStops(max: number): number[] {
  const candidates = [0, Math.round(max / 2), Math.round(max * 0.8), max];
  return Array.from(new Set(candidates)).sort((a, b) => a - b);
}

/** Snaps an arbitrary stored value to the nearest available stop. */
export function nearestHzStop(value: number, stops: number[]): number {
  return stops.reduce((best, stop) =>
    Math.abs(stop - value) < Math.abs(best - value) ? stop : best,
  );
}
