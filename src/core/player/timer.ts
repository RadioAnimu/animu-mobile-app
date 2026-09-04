/**
 * Minimal timer abstraction. Every scheduling unit (backoff, track-end
 * refresh) depends on this instead of raw `setTimeout`, so tests can inject
 * a fake clock and advance time deterministically.
 */
export interface Timer {
  /** Schedules `callback` after `ms`; returns a cancellable id. */
  set(callback: () => void, ms: number): number;
  /** Cancels a pending timer (no-op for null ids). */
  clear(id: number | null): void;
}

/** Production timer backed by the global JS timers. */
export const jsTimer: Timer = {
  set: (callback, ms) => setTimeout(callback, ms) as unknown as number,
  clear: (id) => {
    if (id == null) return;
    clearTimeout(id as unknown as NodeJS.Timeout);
  },
};
