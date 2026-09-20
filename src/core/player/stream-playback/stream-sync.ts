import { getTrackProgress, type Track } from "@/core/domain/track";

/**
 * Maximum plausible lag between the station's live point and the audible
 * audio (ms). Anything larger is a bogus native reading and is clamped, so
 * one bad sample can never pin the UI at the start of a track.
 */
const MAX_DELAY_MS = 60_000;
/**
 * A measured lag that differs from the running estimate by more than this is
 * treated as a re-lock — a stream swap, a codec change (AAC+ buffers far
 * deeper than MP3) or a reconnect that landed on a different buffer depth.
 * Those snap to the new value instead of easing; a slow filter would take
 * seconds to catch up while the UI is visibly out of sync.
 */
const SNAP_THRESHOLD_MS = 3_000;
/**
 * Maximum per-reading increase in the lag estimate (ms). The forward buffer
 * fills in a ramp after a (re)connect — easing that ramp made the UI lead the
 * audio by seconds until it caught up — so a rise tracks the measurement up
 * to this step per native frame (≈1 Hz). It also caps a transient spike's
 * backward nudge, while the fall below stays smooth.
 */
const RISE_MAX_STEP_MS = 1_000;
/** Weight kept on the previous estimate while easing a *falling* lag. */
const FALL_SMOOTHING = 0.85;
/**
 * Device-vs-server clock offset is only applied past this magnitude (ms).
 * HTTP `date` headers have one-second resolution, so acting on a small
 * reading would inject more error than it removes; a grossly wrong device
 * clock (minutes off) is what this guards against.
 */
const CLOCK_SKEW_THRESHOLD_MS = 3_000;
/** Absolute cap on the applied skew (ms) — a day, to reject nonsense. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
/**
 * Consecutive `isLive: false` frames before the estimate is discarded.
 * An item swap (`replace()`) emits a couple of teardown frames at ~1 Hz;
 * a genuine non-live source keeps reporting false forever.
 */
const SUSTAINED_NON_LIVE_FRAMES = 5;

/** A native live-offset reading, in the shape the audio port reports it. */
export interface LiveOffsetStatus {
  /** Whether the source is an indefinite live stream. */
  isLive: boolean;
  /** Seconds behind the live edge; `null` when the platform cannot measure it. */
  offsetFromLive: number | null;
  /**
   * Fallback: seconds of audio loaded ahead of the playhead. Used when
   * `offsetFromLive` is `null` — live ICY/progressive streams often expose no
   * manifest window for the platform to measure, but the forward buffer is
   * still the delay the listener hears.
   */
  bufferedAheadSeconds?: number | null;
}

/**
 * Arrival anchor for an SSE `song_change`: the station-side start epoch and
 * the client arrival epoch (the package's per-event `ts` / `receivedAt`).
 *
 * The two clocks are independent (a device can be minutes off), so the
 * anchor is never used as a raw clock delta. It marks the instant a new
 * track reached the station, which is what forces the next native offset
 * reading to re-lock — the decoder has just swapped content and its buffer
 * depth is the least trustworthy right then.
 */
export interface SyncAnchor {
  /** Station-side epoch ms of the track's start (`track.startTime`). */
  startTimeMs: number;
  /** Client arrival epoch ms of the event that announced it (`ts`). */
  receivedAtMs: number;
}

/**
 * The stream sync engine — the UI's answer to "what is the listener hearing
 * right now?".
 *
 * The station's `startTime`/`duration` describe the broadcast at its live
 * point, but the audio is buffered on the way to the speaker (network jitter
 * + codec + decoder + output), so a UI clocked off `Date.now()` runs ahead by
 * that whole stack. `expo-audio` measures the gap for us as
 * `currentOffsetFromLive` (iOS from `AVPlayerItem.currentDate()`, Android
 * from ExoPlayer), with a patched `bufferedAhead` fallback for live
 * ICY/progressive streams that expose no measurable live window. This engine
 * turns either into an **audible station clock**:
 *
 * ```
 * audibleNow = Date.now() - delayMs
 * ```
 *
 * Every station-timeline consumer (progress, countdown, media-session
 * position, predictive track-end) reads `now()` instead of `Date.now()`, so
 * they all land on the audio the user actually hears — including the extra
 * delay of an AAC+ relay, with no per-codec constants.
 *
 * The engine is measurement-driven but defensive: the last known delay is
 * kept when a reading is missing, `isLive: false` clears it, and a large
 * step snaps rather than eases. The fallback when nothing was ever measured
 * is zero — the historical "live point" behaviour, so a platform that cannot
 * measure degrades to what shipped before, never worse. A server clock
 * correction ({@link setClockSkew}, fed from HTTP `date` headers) keeps the
 * comparison valid on a device whose clock is grossly wrong.
 */
export class StreamSyncEngine {
  /** Smoothed lag of the audible audio behind the stream's live edge (ms). */
  private delayMs = 0;
  /** Whether a native measurement has ever landed (distinguishes 0 from unknown). */
  private measured = false;
  /** Forces the next native reading to snap (set by a fresh SSE anchor). */
  private recalibrate = false;
  /** Most recent SSE arrival anchor; diagnostics only. */
  private lastAnchorValue: SyncAnchor | null = null;
  /**
   * Server clock minus device clock (ms). Corrects a grossly wrong device
   * time so the station-timeline comparison still holds. See
   * {@link setClockSkew}.
   */
  private clockSkewMs = 0;
  /**
   * Consecutive `isLive: false` frames seen. An item teardown/report gap
   * flips the flag for a frame or two; only a sustained non-live source
   * (e.g. a local file) is a true "not a broadcast" state. Before that
   * threshold the last known lag is held — the post-`replace()` transition
   * used to blank the estimate and fling the UI to the live point.
   */
  private nonLiveFrames = 0;

  /**
   * Folds a native status reading into the delay estimate.
   *
   * A finite offset is trusted on its own — the platform's `isLive` flag is
   * not a reliable gate for every container (some progressive/ICY streams
   * report `isLive: false` while still exposing a live offset). Only an
   * unmeasurable offset falls back: keep the last known value for a live
   * source, clear it for a genuinely non-live one.
   */
  updateFromStatus(status: LiveOffsetStatus): void {
    // Prefer the platform's absolute live offset; fall back to the forward
    // buffer (patched native field) when the stream has no live window.
    const rawOffset =
      status.offsetFromLive != null &&
      Number.isFinite(status.offsetFromLive) &&
      status.offsetFromLive >= 0
        ? status.offsetFromLive
        : status.bufferedAheadSeconds;

    if (rawOffset == null || !Number.isFinite(rawOffset) || rawOffset < 0) {
      // Only a SUSTAINED non-live source clears the estimate: an item
      // teardown (`replace()`) emits an `isLive: false` frame or two and a
      // blanking here flung the UI to the live point mid-song.
      this.nonLiveFrames = status.isLive ? 0 : this.nonLiveFrames + 1;
      if (this.nonLiveFrames >= SUSTAINED_NON_LIVE_FRAMES) {
        this.delayMs = 0;
        this.measured = false;
        this.recalibrate = false;
      }
      // Live (or in a brief teardown gap): keep the last known delay.
      return;
    }

    this.nonLiveFrames = 0;
    const measured = Math.min(MAX_DELAY_MS, rawOffset * 1000);
    const snap =
      this.recalibrate ||
      !this.measured ||
      Math.abs(measured - this.delayMs) > SNAP_THRESHOLD_MS;
    if (snap) {
      this.delayMs = measured;
    } else if (measured > this.delayMs) {
      // Track a rising lag tightly (bounded) so the UI never runs ahead.
      this.delayMs = Math.min(measured, this.delayMs + RISE_MAX_STEP_MS);
    } else {
      // Ease a falling lag so the UI does not jump forward on buffer drain.
      this.delayMs =
        this.delayMs * FALL_SMOOTHING + measured * (1 - FALL_SMOOTHING);
    }
    this.measured = true;
    this.recalibrate = false;
  }

  /**
   * Records an SSE `song_change` arrival (station `startTime` + client `ts`)
   * and arms a re-lock so the next native offset is trusted verbatim.
   */
  updateFromAnchor(anchor: SyncAnchor): void {
    this.lastAnchorValue = anchor;
    this.recalibrate = true;
  }

  /** Clears the estimate (new stream, reconnect, teardown). */
  reset(): void {
    this.delayMs = 0;
    this.measured = false;
    this.recalibrate = false;
    this.nonLiveFrames = 0;
    this.lastAnchorValue = null;
  }

  /**
   * The listener's "now" on the station timeline (epoch ms): what the
   * speaker is producing this instant rather than the live point. Applies
   * the server clock correction and, until a live offset has been measured,
   * falls back to the corrected wall clock.
   */
  now(): number {
    const wall = Date.now() + this.clockSkewMs;
    if (!this.measured) return wall;
    return wall - this.delayMs;
  }

  /**
   * Records the server-vs-device clock offset (ms), measured from an HTTP
   * `date` header with RTT/2 correction. Only gross offsets are applied
   * (see the threshold) so a correctly-set device clock is never nudged by
   * the header's one-second resolution. Survives {@link reset} — it is a
   * property of the device, not of one stream.
   */
  setClockSkew(skewMs: number): void {
    if (!Number.isFinite(skewMs)) return;
    if (Math.abs(skewMs) < CLOCK_SKEW_THRESHOLD_MS) {
      this.clockSkewMs = 0;
      return;
    }
    this.clockSkewMs = Math.max(
      -MAX_CLOCK_SKEW_MS,
      Math.min(MAX_CLOCK_SKEW_MS, skewMs),
    );
  }

  /** Applied server-vs-device clock offset (ms) — diagnostics. */
  get clockSkew(): number {
    return this.clockSkewMs;
  }

  /** Whether the track starting at `startTimeMs` has reached the speaker. */
  isAudible(startTimeMs: number): boolean {
    return this.now() >= startTimeMs;
  }

  /** Current audible lag behind the live edge (ms) — diagnostics. */
  get delay(): number {
    return this.delayMs;
  }

  /** Whether a native delay measurement has landed. */
  get hasMeasurement(): boolean {
    return this.measured;
  }

  /** Last SSE arrival anchor, when one was seen. */
  get lastAnchor(): SyncAnchor | null {
    return this.lastAnchorValue;
  }
}

/** Progress of a track on the listener's timeline. */
export interface SyncedProgress {
  /**
   * Elapsed ms, or `null` when there is nothing to show — the track has no
   * usable duration, or it has already ended.
   */
  elapsedMs: number | null;
  /**
   * The announced track has not reached the speaker yet (its `startTime` is
   * still ahead of the audible clock). The previous track is what the speaker
   * is finishing, so callers carry its bar forward rather than clearing it.
   */
  pending: boolean;
}

/**
 * Progress for the track the listener is *hearing*, resolved against the
 * sync engine's audible clock. Split out from `getTrackProgress` so callers
 * can tell "not started yet" from "ended" — the package helper collapses
 * both to `null`, which would blank the seek bar for the whole delay window
 * after every song change.
 */
export function getSyncedTrackProgress(
  track: Track | null | undefined,
  nowMs: number,
): SyncedProgress {
  if (!track) return { elapsedMs: null, pending: false };

  const start = track.startTime?.getTime();
  if (start == null || !Number.isFinite(start)) {
    return { elapsedMs: null, pending: false };
  }
  if (nowMs < start) return { elapsedMs: null, pending: true };

  return { elapsedMs: getTrackProgress(track, nowMs), pending: false };
}
