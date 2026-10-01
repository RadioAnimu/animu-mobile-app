import type { Timer } from "@/core/player/timer";

/**
 * Deadline for dropping a paused stream. Scheduled on the player's pumped
 * timer, so it also fires from native status frames while JS timers are
 * suspended in the background.
 */
export class PauseReleaseTimer {
  private timerId: number | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly onDue: () => void,
    private readonly timer: Timer,
  ) {}

  /** (Re)starts the countdown. */
  arm(): void {
    this.cancel();
    this.timerId = this.timer.set(() => {
      this.timerId = null;
      this.onDue();
    }, this.delayMs);
  }

  cancel(): void {
    this.timer.clear(this.timerId);
    this.timerId = null;
  }

  get isArmed(): boolean {
    return this.timerId != null;
  }
}
