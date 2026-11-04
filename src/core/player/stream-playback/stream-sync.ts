import type { Progress } from "react-native-anything-player";

/**
 * A settled reading this far (ms) from the clock moves it: above RNAP's own
 * noise on a progressive stream like the station's (its live point may rise
 * 0.1 s and stay settled).
 */
const MOVE_MS = 150;
/**
 * A browser's plain `<audio>` has no live offset: the buffer stands in. It
 * only under-reads the lag (and drains between loads), so it moves the clock
 * only this far (ms) behind it.
 */
const BUFFER_BEHIND_MS = 2_000;

/**
 * The clock skew is applied once its median reaches this (ms): `date` headers
 * have one-second resolution, so a smaller correction adds more error than it
 * removes.
 */
const CLOCK_SKEW_APPLY_MS = 1_500;
/** Once applied, the skew drops only below this, so a value near the edge does not flap. */
const CLOCK_SKEW_RELEASE_MS = 800;
/** How many recent skew samples feed the median. */
const SKEW_WINDOW = 9;
/** Samples whose round-trip exceeded this are too imprecise to use (ms). */
const SKEW_MAX_RTT_MS = 2_500;
/** Absolute cap on the applied skew (ms) — a day, to reject nonsense. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** The part of an RNAP progress reading the clock reads (seconds; `timestamp` in epoch ms). */
export type LiveOffsetReading = Pick<
  Progress,
  "liveOffset" | "liveOffsetSettled" | "bufferedAhead" | "timestamp"
>;

/** The reading's lag behind live (s): `liveOffset`, else the buffer where there is none. */
export const lagSeconds = (reading: Pick<Progress, "liveOffset" | "bufferedAhead">): number =>
  reading.liveOffset ?? reading.bufferedAhead;

/**
 * The audible clock as a fixed point: the station time heard at wall clock
 * `at`, advancing in real time while `running`. The same object until it
 * moves, so consumers can extrapolate it without polling.
 */
export interface AudibleAnchor {
  /** Station-timeline epoch ms heard at `at`. */
  readonly stationMs: number;
  /** Wall-clock epoch ms of the anchor. */
  readonly at: number;
  /** Audio flows: the station time advances with the wall clock. */
  readonly running: boolean;
}

const stationAt = (anchor: AudibleAnchor, at: number): number =>
  anchor.stationMs + (anchor.running ? at - anchor.at : 0);

/**
 * What the listener hears right now, on the station timeline.
 *
 * The station's `startTime`/`duration` describe its live point; the audio
 * reaches the speaker later. RNAP measures how far what is heard trails the
 * audio arriving on the device as `liveOffset` (the server's burst, the
 * buffer, the decoder) and says when it has settled, so the audible clock is
 * `reading time + skew − liveOffset`. Network transit and the station's own
 * lead over its audio are not in it: the tune-in calibration
 * (`HeardTrack.tuneInBiasMs`) covers them. Every station-timeline consumer
 * reads {@link now} instead of `Date.now()`.
 *
 * A settled reading places the clock ({@link anchor}); later ones move it
 * only past {@link MOVE_MS}, so the clock holds still between real changes.
 * RNAP measures the offset wherever it reads the stream (Android, iOS, the
 * web through MSE); on a browser's plain `<audio>` it has none, and the
 * buffer stands in, moving the clock only when lastingly behind it.
 *
 * The server clock correction ({@link setClockSkew}) covers a wrong device
 * clock: the station's times are the server's.
 */
export class StreamSyncEngine {
  /** The latest lag reading (ms), settled or not; `null` before any. */
  private lagMs: number | null = null;
  private lock: AudibleAnchor | null = null;
  /** Whether audio is flowing (the clock advances only while it is). */
  private running = true;
  /** Server clock minus device clock (ms), see {@link setClockSkew}. */
  private clockSkewMs = 0;
  /** Recent raw skew samples (ms) — the applied skew is their median. */
  private readonly skewSamples: number[] = [];

  /** A native progress reading. Returns whether the clock moved. */
  reading(reading: LiveOffsetReading): boolean {
    const buffer = reading.liveOffset == null;
    const lagS = lagSeconds(reading);
    if (!Number.isFinite(lagS) || lagS < 0) return false;
    this.lagMs = lagS * 1000;
    if (!buffer && !reading.liveOffsetSettled) return false;
    const at = reading.timestamp;
    const stationMs = at + this.clockSkewMs - this.lagMs;
    const lock = this.lock;
    if (lock) {
      // > 0: the reading hears the station later than the clock does.
      const behind = stationAt(lock, at) - stationMs;
      if (buffer ? behind < BUFFER_BEHIND_MS : Math.abs(behind) <= MOVE_MS) return false;
    }
    this.lock = { stationMs, at, running: this.running };
    return true;
  }

  /** Audio started or stopped (pause, stall, resume): the clock holds while it is stopped. */
  setRunning(running: boolean, at: number = Date.now()): void {
    if (this.running === running) return;
    this.running = running;
    const lock = this.lock;
    if (lock) this.lock = { stationMs: stationAt(lock, at), at, running };
  }

  /** Clears the clock (new stream, reconnect, teardown). */
  reset(): void {
    this.lagMs = null;
    this.lock = null;
  }

  /**
   * The listener's "now" on the station timeline (epoch ms): the settled
   * clock, else the latest reading, else the skew-corrected wall clock.
   */
  now(): number {
    const now = Date.now();
    if (this.lock) return stationAt(this.lock, now);
    return now + this.clockSkewMs - (this.lagMs ?? 0);
  }

  /** The settled clock as a fixed point, or `null` until settled. */
  get anchor(): AudibleAnchor | null {
    return this.lock;
  }

  /** Whether the clock is placed from a settled reading. */
  get settled(): boolean {
    return this.lock != null;
  }

  /**
   * How far the speaker trails the live edge on the settled clock (ms),
   * stopped time included; `null` until settled.
   */
  get lockedLag(): number | null {
    const lock = this.lock;
    if (!lock) return null;
    const now = Date.now();
    return now + this.clockSkewMs - stationAt(lock, now);
  }

  /** Whether any lag reading has landed. */
  get hasMeasurement(): boolean {
    return this.lagMs != null;
  }

  /**
   * Records a server-vs-device clock offset sample (ms) from an HTTP `date`
   * header. Slow round-trips are dropped; the applied skew is the window's
   * median, between the apply/release thresholds. Survives {@link reset}: it
   * belongs to the device, not the stream.
   */
  setClockSkew(skewMs: number, rttMs?: number): void {
    if (!Number.isFinite(skewMs)) return;
    if (rttMs != null && rttMs > SKEW_MAX_RTT_MS) return;

    this.skewSamples.push(skewMs);
    if (this.skewSamples.length > SKEW_WINDOW) this.skewSamples.shift();

    const sorted = [...this.skewSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const threshold =
      this.clockSkewMs === 0 ? CLOCK_SKEW_APPLY_MS : CLOCK_SKEW_RELEASE_MS;
    this.clockSkewMs =
      Math.abs(median) < threshold
        ? 0
        : Math.max(-MAX_CLOCK_SKEW_MS, Math.min(MAX_CLOCK_SKEW_MS, median));
  }

  /** Applied server-vs-device clock offset (ms); HeardTrack's tune-in correction reads it too. */
  get clockSkew(): number {
    return this.clockSkewMs;
  }

  /** Whether the track starting at `startTimeMs` has reached the speaker. */
  isAudible(startTimeMs: number): boolean {
    return this.now() >= startTimeMs;
  }
}
