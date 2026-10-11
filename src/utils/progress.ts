/** Progress math shared by the bar and the countdown (clamp is UI, not domain). */

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

/** The progress store's real-time anchor (see `ProgressSnapshot`). */
export interface ProgressAnchor {
  /** Elapsed ms at `progressAt`; `null` while unknown. */
  progressMs: number | null;
  /** Wall clock the anchor holds at. */
  progressAt: number;
  /** Advancing in real time from `progressAt`. */
  progressRunning: boolean;
}

/**
 * Elapsed ms of `anchor` at wall clock `now`, within the track (`null` while
 * unknown). Past the end it holds at the end: the next song is not heard yet.
 */
export function elapsedAt(
  anchor: ProgressAnchor,
  durationMs: number | undefined,
  now: number,
): number | null {
  const { progressMs, progressAt, progressRunning } = anchor;
  if (progressMs == null || !Number.isFinite(progressMs)) return null;
  const elapsed = Math.max(
    0,
    progressMs + (progressRunning ? Math.max(0, now - progressAt) : 0),
  );
  return durationMs && durationMs > 0 ? Math.min(elapsed, durationMs) : elapsed;
}

/**
 * Wait (ms) until a whole-second countdown showing `remainingMs` flips to its
 * next value — scheduling to the boundary itself makes every displayed second
 * last exactly one second, instead of whenever a polling tick happens to land.
 */
export function msUntilNextSecond(remainingMs: number): number {
  return (Math.max(0, remainingMs) % 1_000) + 1;
}
