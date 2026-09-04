import type { Timer } from "./timer";

/** Exponential backoff delay for a (0-based) attempt: base → 2× → 4× … capped */
export const backoffDelay = (
  attempt: number,
  base: number,
  max: number,
): number => Math.min(base * Math.pow(2, Math.max(0, attempt)), max);

export interface BackoffSchedulerOptions {
  /** First retry delay (ms) — doubles each consecutive attempt. */
  baseMs: number;
  /** Cap for the computed delay (ms). */
  maxMs: number;
  timer: Timer;
  /** Log tag, e.g. "stream-reconnect" — makes concurrent schedulers traceable. */
  label: string;
}

/**
 * Owns an attempt counter + one pending timer. Used for both the stream
 * reconnect chain and the now-playing data refresh retry chain.
 */
export class BackoffScheduler {
  private attempts = 0;
  private timerId: number | null = null;

  constructor(private readonly options: BackoffSchedulerOptions) {}

  get isPending(): boolean {
    return this.timerId != null;
  }

  /** Number of consecutive attempts so far (incremented by `schedule`). */
  get attemptCount(): number {
    return this.attempts;
  }

  /**
   * Schedules `action` after the current backoff delay and bumps the
   * attempt counter. Returns the delay used (handy for logging).
   */
  schedule(action: () => void): number {
    this.cancel();

    const delay = backoffDelay(
      this.attempts,
      this.options.baseMs,
      this.options.maxMs,
    );
    this.attempts++;

    this.timerId = this.options.timer.set(() => {
      this.timerId = null;
      action();
    }, delay);

    return delay;
  }

  /** Cancels the pending timer but keeps the attempt counter. */
  cancel(): void {
    this.options.timer.clear(this.timerId);
    this.timerId = null;
  }

  /** Cancels the pending timer and zeroes the attempt counter. */
  reset(): void {
    this.cancel();
    this.attempts = 0;
  }
}
