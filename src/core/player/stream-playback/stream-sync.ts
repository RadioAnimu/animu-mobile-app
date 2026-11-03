import { MEDIA_ALIGN_MS } from "@/core/player/stream-playback/heard-track";

/** Largest plausible lag behind the live point (ms); a bigger reading is bogus and clamped. */
const MAX_DELAY_MS = 60_000;
/**
 * A reading this far from the estimate is a re-lock (stream swap, codec
 * change, reconnect at another buffer depth): it snaps instead of easing.
 */
const SNAP_THRESHOLD_MS = 3_000;
/**
 * Largest rise of the estimate per reading (≈1 Hz). The buffer fills in a
 * ramp after a (re)connect, and easing it let the UI lead the audio; the
 * step also caps a spike's backward nudge.
 */
const RISE_MAX_STEP_MS = 1_000;
/** Weight kept on the previous estimate while easing a *falling* lag. */
const FALL_SMOOTHING = 0.85;
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
/**
 * Consecutive `isLive: false` frames before the estimate is discarded: an
 * item swap (`replace()`) emits a couple at ~1 Hz, a non-live source forever.
 */
const SUSTAINED_NON_LIVE_FRAMES = 5;
/**
 * {@link StreamSyncEngine.settled}: the first reading can be a stale sample
 * the engine then eases upward, so "calculating" lasts until the estimate has
 * been quiet a while, with a hard cap.
 */
/** Minimum quiet period after the first measurement. */
const SETTLE_MIN_MS = 2_500;
/** The estimate must hold this long without a material change. */
const SETTLE_STABLE_MS = 1_500;
/** Hard cap — the "calculating" state never outlives this. */
const SETTLE_MAX_MS = 12_000;
/** A delay move of at least this counts as "still moving". */
const SETTLE_EPSILON_MS = 200;
/**
 * Readings can only *under*-read the lag (the player cannot hold audio not
 * yet sent), so a lock taken during the connect burst shows as readings
 * climbing past it. Staying this far above it for
 * {@link RELOCK_BEHIND_FRAMES} readings re-takes the lock; readings below
 * it never move it.
 */
const RELOCK_BEHIND_MS = 2_000;
/** Consecutive readings (≈1 Hz) the lock must look behind before it moves. */
const RELOCK_BEHIND_FRAMES = 5;

/** A native live-offset reading, in the shape the audio port reports it. */
export interface LiveOffsetStatus {
  /** Whether the source is an indefinite live stream. */
  isLive: boolean;
  /** Seconds behind the live edge; `null` when the platform cannot measure it. */
  offsetFromLive: number | null;
  /**
   * Seconds loaded ahead of the playhead, used when `offsetFromLive` is
   * `null`: ICY/progressive streams often have no live window to measure.
   */
  bufferedAheadSeconds?: number | null;
}

/**
 * The audible clock as a fixed point: the station time heard at wall clock
 * `at`, advancing in real time while `running`. Unchanged between lock
 * events, so consumers can extrapolate it without polling.
 */
export interface AudibleAnchor {
  /** Station-timeline epoch ms heard at `at`. */
  stationMs: number;
  /** Wall-clock epoch ms of the anchor. */
  at: number;
  /** Audio flows: the station time advances with the wall clock. */
  running: boolean;
}

/** A locked audible clock: station time = wall clock + `offsetMs`. */
interface ClockLock {
  /** Station time minus wall clock while audio flows (skew − lag). */
  offsetMs: number;
  /** Wall clock the current lock segment began at (lock, resume, re-lock). */
  at: number;
  /** Wall clock audio stopped at; `null` while it flows. */
  heldAt: number | null;
}

/**
 * What the listener hears right now, on the station timeline.
 *
 * The station's `startTime`/`duration` describe its live point, but the audio
 * reaches the speaker later (network, codec, decoder, output). The player
 * measures that lag as its live offset, or the forward buffer when the stream
 * has no live window, and this engine turns it into an audible clock:
 * `audibleNow = Date.now() - delayMs`. Every station-timeline consumer reads
 * {@link now} instead of `Date.now()`.
 *
 * **Once settled, the clock is locked.** Readings jitter with delivery, but
 * while audio plays the real lag cannot change, so the settled estimate
 * becomes a fixed offset and consumers advance in true seconds. The lag only
 * changes when audio stops ({@link setRunning}) or the source re-opens
 * ({@link reset}); readings move the lock only when lastingly behind it
 * ({@link RELOCK_BEHIND_MS}).
 *
 * With nothing measured the delay is zero (the live point). The server clock
 * correction ({@link setClockSkew}) covers a grossly wrong device clock.
 */
export class StreamSyncEngine {
  /** Smoothed lag of the audible audio behind the stream's live edge (ms). */
  private delayMs = 0;
  /** Whether a native measurement has ever landed (distinguishes 0 from unknown). */
  private measured = false;
  /** Server clock minus device clock (ms), see {@link setClockSkew}. */
  private clockSkewMs = 0;
  /** Recent raw skew samples (ms) — the applied skew is their median. */
  private readonly skewSamples: number[] = [];
  /** Consecutive `isLive: false` frames (see {@link SUSTAINED_NON_LIVE_FRAMES}). */
  private nonLiveFrames = 0;
  /** When the estimate first became measured (0 = not measured). */
  private measuredSinceMs = 0;
  /** When the delay last moved by {@link SETTLE_EPSILON_MS} or more. */
  private delayChangedAtMs = 0;
  /**
   * "The clock is locked", latched for the stream's life: later small drifts
   * must not re-show "calculating". Only a re-measure clears it.
   */
  private settledLatch = false;
  /** The locked clock, from the moment the estimate settled (`null` before). */
  private lock: ClockLock | null = null;
  /** Whether audio is flowing (the locked clock advances only while it is). */
  private running = true;
  /** Consecutive readings the estimate sat clearly above the locked lag. */
  private behindFrames = 0;
  /** The lock on the player's media clock: station ms at a media position (ms). */
  private media: { positionMs: number; stationMs: number } | null = null;

  /**
   * Folds a native reading into the delay estimate. A finite offset is
   * trusted even with `isLive: false` (some ICY streams report it while
   * measurable); an unmeasurable one keeps the last value, or clears it for a
   * sustained non-live source.
   */
  updateFromStatus(status: LiveOffsetStatus): void {
    const rawOffset =
      status.offsetFromLive != null &&
      Number.isFinite(status.offsetFromLive) &&
      status.offsetFromLive >= 0
        ? status.offsetFromLive
        : status.bufferedAheadSeconds;

    if (rawOffset == null || !Number.isFinite(rawOffset) || rawOffset < 0) {
      this.nonLiveFrames = status.isLive ? 0 : this.nonLiveFrames + 1;
      if (this.nonLiveFrames >= SUSTAINED_NON_LIVE_FRAMES) {
        this.delayMs = 0;
        this.measured = false;
        this.measuredSinceMs = 0;
        this.delayChangedAtMs = 0;
        this.settledLatch = false;
        this.unlock();
      }
      return;
    }

    this.nonLiveFrames = 0;
    const previousDelay = this.delayMs;
    const wasMeasured = this.measured;
    const measured = Math.min(MAX_DELAY_MS, rawOffset * 1000);
    const snap =
      !this.measured ||
      Math.abs(measured - this.delayMs) > SNAP_THRESHOLD_MS;
    if (snap) {
      this.delayMs = measured;
    } else if (measured > this.delayMs) {
      // A rising lag is tracked tightly, so the UI never runs ahead.
      this.delayMs = Math.min(measured, this.delayMs + RISE_MAX_STEP_MS);
    } else {
      // A falling one eases, so a buffer drain does not jump the UI forward.
      this.delayMs =
        this.delayMs * FALL_SMOOTHING + measured * (1 - FALL_SMOOTHING);
    }
    this.measured = true;

    const now = Date.now();
    if (!wasMeasured) {
      this.measuredSinceMs = now;
      this.delayChangedAtMs = now;
    } else if (Math.abs(this.delayMs - previousDelay) >= SETTLE_EPSILON_MS) {
      this.delayChangedAtMs = now;
    } else {
      // Moved less than the epsilon: still settled.
    }
    this.refreshLock(now);
    this.checkLockBehind(measured, now);
  }

  /**
   * Audio started or stopped (pause, stall, resume). The station broadcasts
   * on meanwhile, so the locked clock holds and the stopped time is added to
   * the lag on resume.
   */
  setRunning(running: boolean, at: number = Date.now()): void {
    if (this.running === running) return;
    this.running = running;
    this.behindFrames = 0;
    const lock = this.lock;
    if (!lock) return;
    if (running) {
      if (lock.heldAt != null) lock.offsetMs -= at - lock.heldAt;
      lock.heldAt = null;
      lock.at = at;
    } else {
      lock.heldAt = at;
    }
  }

  /** Latches {@link settled} and locks the clock in the same instant. */
  private refreshLock(now: number = Date.now()): void {
    if (this.settledLatch || !this.evaluateSettled(now)) return;
    this.settledLatch = true;
    this.media = null;
    this.lock = {
      offsetMs: this.clockSkewMs - this.delayMs,
      at: now,
      heldAt: this.running ? null : now,
    };
    this.behindFrames = 0;
  }

  /**
   * Re-takes a lock the raw readings stayed clearly above (see
   * {@link RELOCK_BEHIND_MS}). Raw, not eased: the estimate lingers high
   * after a spike.
   */
  private checkLockBehind(measuredMs: number, now: number): void {
    const lock = this.lock;
    if (!lock || lock.heldAt != null) return;
    const lockedDelay = this.clockSkewMs - lock.offsetMs;
    if (measuredMs - lockedDelay < RELOCK_BEHIND_MS) {
      this.behindFrames = 0;
      return;
    }
    this.behindFrames += 1;
    if (this.behindFrames < RELOCK_BEHIND_FRAMES) return;
    lock.offsetMs = this.clockSkewMs - measuredMs;
    lock.at = now;
    this.behindFrames = 0;
    this.media = null;
  }

  private unlock(): void {
    this.lock = null;
    this.behindFrames = 0;
    this.media = null;
  }

  /**
   * Keeps the lock on the player's media clock, like
   * `HeardTrack.alignToMedia`: a stop or start may be handled late, the
   * media position only advances with the audio. The first reading after
   * the lock is its reference. Returns whether the lock moved.
   */
  alignToMedia(positionS: number, atMs: number): boolean {
    const lock = this.lock;
    if (!lock || !Number.isFinite(positionS) || !Number.isFinite(atMs)) return false;
    const positionMs = positionS * 1000;
    const stationMs = (lock.heldAt ?? atMs) + lock.offsetMs;
    const reference = this.media;
    // No reference yet, or the media clock restarted (a new connection).
    if (!reference || positionMs < reference.positionMs) {
      this.media = { positionMs, stationMs };
      return false;
    }
    const expected = reference.stationMs + (positionMs - reference.positionMs);
    if (Math.abs(expected - stationMs) <= MEDIA_ALIGN_MS) return false;
    if (lock.heldAt == null) {
      lock.offsetMs = expected - atMs;
      lock.at = atMs;
    } else {
      lock.offsetMs = expected - lock.heldAt;
    }
    return true;
  }

  /** Clears the estimate and the lock (new stream, reconnect, teardown). */
  reset(): void {
    this.delayMs = 0;
    this.measured = false;
    this.nonLiveFrames = 0;
    this.measuredSinceMs = 0;
    this.delayChangedAtMs = 0;
    this.settledLatch = false;
    this.unlock();
  }

  /**
   * The listener's "now" on the station timeline (epoch ms): the locked
   * clock once settled, the running estimate before, the skew-corrected wall
   * clock until anything was measured.
   */
  now(): number {
    const now = Date.now();
    this.refreshLock(now);
    const lock = this.lock;
    if (lock) return (lock.heldAt ?? now) + lock.offsetMs;
    const wall = now + this.clockSkewMs;
    if (!this.measured) return wall;
    return wall - this.delayMs;
  }

  /** The locked clock as a fixed point, or `null` until settled; changes only with the lock. */
  get anchor(): AudibleAnchor | null {
    this.refreshLock();
    const lock = this.lock;
    if (!lock) return null;
    const at = lock.heldAt ?? lock.at;
    return { stationMs: at + lock.offsetMs, at, running: lock.heldAt == null };
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

  /** Current audible lag behind the live edge (ms) — diagnostics. */
  get delay(): number {
    return this.delayMs;
  }

  /**
   * How far the speaker trails the live edge on the locked clock (ms),
   * stopped time included; `null` until settled. Unlike a reading, it does
   * not fall while the buffer drains through an outage.
   */
  get lockedLag(): number | null {
    this.refreshLock();
    const lock = this.lock;
    if (!lock) return null;
    const now = Date.now();
    return now + this.clockSkewMs - ((lock.heldAt ?? now) + lock.offsetMs);
  }

  /**
   * Whether the estimate has settled enough for the UI to trust it (unlike
   * {@link hasMeasurement}, true on the first reading). Latched until
   * {@link reset}; evaluating it locks the clock.
   */
  get settled(): boolean {
    this.refreshLock();
    return this.settledLatch;
  }

  /** Time/quiet-window check behind {@link settled} (pre-latch). */
  private evaluateSettled(now: number): boolean {
    if (!this.measured || this.measuredSinceMs === 0) return false;
    const sinceMeasured = now - this.measuredSinceMs;
    if (sinceMeasured < SETTLE_MIN_MS) return false;
    if (sinceMeasured >= SETTLE_MAX_MS) return true;
    return now - this.delayChangedAtMs >= SETTLE_STABLE_MS;
  }

  /** Whether a native delay measurement has landed. */
  get hasMeasurement(): boolean {
    return this.measured;
  }
}
