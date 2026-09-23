/**
 * Smoothing math for {@link useSmoothedElapsed} — pure and dependency-free so
 * it can be unit-tested without React Native.
 */

/** Exponential catch-up time constant (ms) — ~1.5s to mostly close a gap. */
export const CATCH_UP_TAU_MS = 1500;
/** Clamp on one step so a background → foreground gap cannot fling the value. */
export const MAX_STEP_MS = 600;
/**
 * Clamp on how far the authoritative value is projected forward between
 * updates. It arrives ~1 Hz, so a gap up to this is bridged smoothly (covers
 * the brief rebuffer/connect gap at a track boundary, letting the bar reach
 * the end); consumers clamp the projection to the track duration.
 */
export const MAX_PROJECT_MS = 8_000;

/** The advancing state behind the smoothed elapsed value. */
export interface SmoothedState {
  /** Authoritative elapsed at the last update (ms). */
  target: number;
  /** Wall clock of the last authoritative update. */
  targetAt: number;
  /** The smoothed value being displayed. */
  value: number;
  /** Wall clock of the last step. */
  tickAt: number;
}

/**
 * One advance+ease step: move the value forward by real time, then close a
 * fraction of the gap to the authoritative value (which itself advances at
 * real time). So a late/jittery update is absorbed smoothly instead of
 * snapping the displayed value.
 */
export function stepSmoothed(
  state: SmoothedState,
  now: number,
  tauMs: number = CATCH_UP_TAU_MS,
): SmoothedState {
  const dt = Math.max(0, Math.min(now - state.tickAt, MAX_STEP_MS));
  // Project the authoritative value forward only while the last update is
  // recent. An older target (a background gap) is not guessed at — the value
  // holds and the next real update re-anchors it.
  const sinceTarget = Math.max(0, now - state.targetAt);
  const projected =
    state.target + (sinceTarget <= MAX_PROJECT_MS ? sinceTarget : 0);
  const advanced = state.value + dt;
  const alpha = 1 - Math.exp(-dt / tauMs);
  return {
    ...state,
    value: advanced + (projected - advanced) * alpha,
    tickAt: now,
  };
}

/**
 * Hard re-anchor after the display has gone stale and the truth moved
 * underneath it (a long background, app freeze, network stall). The gap to
 * the authoritative value is far past what easing was meant to bridge, so
 * animating the correction would show the countdown sweeping through wrong
 * numbers for seconds — the business fact changed off-screen; show it NOW.
 */
export function snapToTarget(
  state: SmoothedState,
  target: number,
  now: number,
): SmoothedState {
  return { ...state, target, targetAt: now, value: target, tickAt: now };
}
