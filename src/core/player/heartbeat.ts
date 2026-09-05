import type { NowPlayingRepository } from "./now-playing.repository";
import type { ProgressTicker } from "./progress-ticker";

/** Minimum spacing between processed beats (ms) — collapses the drivers to ≤1 Hz. */
const MIN_BEAT_INTERVAL_MS = 800;
/**
 * Fast data-refresh cadence: one poll every N processed beats while the
 * user wants audio (~5s of audio). The cadence lives HERE, once — the JS
 * fallback driver and the native driver both beat into this gate, so there
 * is no second 5s constant anywhere else.
 */
const PLAY_BEATS_PER_POLL = 5;
/**
 * Slow data-refresh cadence while paused (foreground): badge/history stay
 * fresh for a user with the app open but paused (battery friendly).
 */
const PAUSED_BEATS_PER_POLL = 30;
/** Sampled debug diagnostics — one line every N processed beats (~30s). */
const SAMPLED_LOG_EVERY_BEATS = 30;

export interface HeartbeatSchedulerOptions {
  /** Watchdog host — a stuck data refresh is expired on every beat. */
  repository: Pick<NowPlayingRepository, "expireStuckRefresh">;
  /** 1 Hz progress tick (see `ProgressTicker`). */
  ticker: Pick<ProgressTicker, "tick">;
  /**
   * Whether the user wants audio right now — picks the fast (playing) vs
   * paused poll cadence.
   */
  isPlayingIntent: () => boolean;
  /** Transport state label for the sampled debug line. */
  stateLabel?: () => string;
  /** Verbose sampled diagnostics. Off by default — prod logs stay quiet. */
  debug?: boolean;
}

/**
 * The player's 1 Hz heartbeat, fed by TWO drivers that this gate collapses
 * into at-most-one processed beat per second:
 *
 * - native `playbackStatusUpdate` events while PLAYING — these keep
 *   firing while the app is backgrounded (foreground service on Android,
 *   background audio on iOS), so progress, the media session and the
 *   data poll stay alive where JS timers freeze/throttle;
 * - the JS heartbeat task — covers paused-in-foreground, where native
 *   events go silent but the radio keeps playing server-side, and acts
 *   as a foreground safety net while playing.
 *
 * Per processed beat:
 * - watchdog: expires a data refresh latched past its hard limit (a
 *   stalled fetch's JS-timer abort never fires in the background);
 * - progress tick (see `ProgressTicker`);
 * - data poll on the fast/paused cadence.
 */
export class HeartbeatScheduler {
  /** Data poll — wired by the orchestrator (avoids a construction cycle). */
  onPoll: () => void = () => {};

  /** Date.now() of the last processed beat (gate window anchor). */
  private lastBeatAt = 0;
  /** Processed beats since the last data poll. */
  private beatsSincePoll = 0;
  /** Total processed beats — drives the sampled debug line. */
  private sampleCount = 0;

  constructor(private readonly options: HeartbeatSchedulerOptions) {}

  /**
   * One tick from either driver. Ticks inside the gate window are dropped,
   * so concurrent drivers (native + JS while playing) cost one beat.
   */
  beat(): void {
    const now = Date.now();
    if (now - this.lastBeatAt < MIN_BEAT_INTERVAL_MS) return;
    this.lastBeatAt = now;

    // Watchdog BEFORE the tick — a latched repository must be unblocked
    // even when the tick itself is a no-op.
    this.options.repository.expireStuckRefresh();
    this.options.ticker.tick();

    if (this.options.debug) {
      this.sampleCount++;
      if (this.sampleCount % SAMPLED_LOG_EVERY_BEATS === 0) {
        console.info(
          `[Heartbeat] ok (${this.sampleCount} beats, state=${
            this.options.stateLabel?.() ?? "?"
          })`,
        );
      }
    }

    this.beatsSincePoll++;
    const cadence = this.options.isPlayingIntent()
      ? PLAY_BEATS_PER_POLL
      : PAUSED_BEATS_PER_POLL;
    if (this.beatsSincePoll >= cadence) {
      this.beatsSincePoll = 0;
      this.onPoll();
    }
  }

  /**
   * Fresh playback session (or teardown): the first beat processes
   * immediately and the poll cycle counts from zero.
   */
  reset(): void {
    this.lastBeatAt = 0;
    this.beatsSincePoll = 0;
    this.sampleCount = 0;
  }
}
