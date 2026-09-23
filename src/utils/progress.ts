/** Progress-ratio math shared by bar renderers (clamp is UI, not domain). */

/**
 * Elapsed ms → 0..1 bar ratio, clamped. Invalid/absent progress reads as
 * the start so a spawning bar never over- or under-fills.
 */
export function progressRatio(
  elapsedMs: number | null,
  durationMs: number | undefined,
): number {
  if (elapsedMs == null || !Number.isFinite(elapsedMs) || !durationMs) return 0;
  return Math.min(Math.max(elapsedMs / durationMs, 0), 1);
}

/** Move smaller than this never needs the snap path (per-bar floor). */
const SNAP_FLOOR_RATIO = 0.03;
/** Real playback can advance at at most 1×; corrections get 1.5× slack. */
const REALTIME_TOLERANCE = 1.5;
/** Cap on wall time considered, so a long silent stretch can't inflate it. */
const MAX_SINCE_MS = 3000;

/**
 * Snap-vs-animate decision for the progress bar, scale-aware.
 *
 * A move counts as a CORRECTION (track change, sync fix, thaw re-anchor)
 * when it exceeds what real audio could have played during the wall time
 * between renders (× tolerance), with a small per-bar floor. This keeps
 * short tracks (8s bumpers) animated at fresh 1 Hz steps instead of
 * treating every normal advance as a snap, while long-frozen catches-ups
 * stay instant. Absent duration degrades to plain animate.
 */
export function isBarCorrection(
  move: number,
  sinceEffectMs: number,
  durationMs: number | undefined,
): boolean {
  // Real playback only ever ADVANCES the bar: any backward move is a
  // correction (new track reset, sync re-lock after a thaw), never natural
  // travel — so it snaps regardless of duration/timing, above the floor.
  if (move < 0) return Math.abs(move) > SNAP_FLOOR_RATIO;
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    // No duration to scale by — fall back to the flat floor.
    return move > SNAP_FLOOR_RATIO;
  }
  const expected = (Math.max(0, Math.min(sinceEffectMs, MAX_SINCE_MS)) / durationMs) * REALTIME_TOLERANCE;
  return Math.abs(move) > Math.max(SNAP_FLOOR_RATIO, expected);
}
