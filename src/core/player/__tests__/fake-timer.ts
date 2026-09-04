import type { Timer } from "../timer";

export interface ScheduledCall {
  id: number;
  fn: () => void;
  ms: number;
}

export interface FakeTimer extends Timer {
  /** All currently-scheduled (not yet cleared) calls. */
  readonly scheduled: readonly ScheduledCall[];
  /** Current virtual time (ms). Delays are `scheduledMs - now`. */
  readonly now: number;
  /** Advances the virtual clock by `ms`, running every due callback in order. */
  advance(ms: number): void;
}

export const createFakeTimer = (): FakeTimer => {
  const pending: ScheduledCall[] = [];
  let nextId = 1;
  let elapsedMs = 0;

  return {
    get scheduled() {
      return pending;
    },
    get now() {
      return elapsedMs;
    },
    set(fn, ms) {
      const id = nextId++;
      pending.push({ id, fn, ms: elapsedMs + ms });
      return id;
    },
    clear(id) {
      if (id == null) return;
      const index = pending.findIndex((call) => call.id === id);
      if (index >= 0) pending.splice(index, 1);
    },
    advance(ms) {
      elapsedMs += ms;
      const due = pending.filter((call) => call.ms <= elapsedMs);
      for (const call of due) {
        this.clear(call.id);
        call.fn();
      }
    },
  };
};
