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

/** A {@link Timer} whose due callbacks can also be fired on demand. */
export interface PumpedTimer extends Timer {
  /** Fires every callback whose deadline has passed, earliest first. */
  pump(): void;
}

/**
 * Wraps `base` with deadline tracking. React Native stops firing JS timers
 * while an Android activity is in the background (screen off included), but
 * native status frames keep arriving — the player pumps this timer on each
 * one, so reconnect backoff, track boundaries and the pause release still
 * fire on time. Each callback runs once, whichever path reaches it first.
 */
export const createPumpedTimer = (
  base: Timer = jsTimer,
  now: () => number = () => Date.now(),
): PumpedTimer => {
  const pending = new Map<number, { fn: () => void; due: number }>();

  const fire = (id: number): void => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    base.clear(id);
    entry.fn();
  };

  return {
    set(fn, ms) {
      const due = now() + ms;
      // The base id doubles as ours; the closure reads it after `set` returns.
      const id: number = base.set(() => fire(id), ms);
      pending.set(id, { fn, due });
      return id;
    },
    clear(id) {
      if (id == null) return;
      pending.delete(id);
      base.clear(id);
    },
    pump() {
      const at = now();
      const due = [...pending]
        .filter(([, entry]) => entry.due <= at)
        .sort(([, a], [, b]) => a.due - b.due);
      for (const [id] of due) fire(id);
    },
  };
};
