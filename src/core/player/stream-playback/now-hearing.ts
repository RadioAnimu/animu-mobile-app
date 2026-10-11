import type { Track } from "@/core/domain/track";
import type { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import type { HeardTrack, TrackPosition } from "@/core/player/stream-playback/heard-track";
import type { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";

/**
 * Playing this long since the source opened without a single ICY title means
 * the stream carries none (the slowest mount, 64 kbps, has its first metadata
 * block 2 s in): the audible clock takes over.
 */
export const ICY_MISSING_MS = 12_000;

/** A native progress reading (seconds), as Airwave reports it. */
export interface LagReading {
  liveOffset: number | null;
  bufferedAhead: number;
}

export interface NowHearingDeps {
  /** What ICY says is heard (the station's titles, at the moment they play). */
  heard: HeardTrack;
  /** The audible station clock: wall clock minus the measured lag. */
  sync: StreamSyncEngine;
  /** The station's track on the audible clock (holds the previous until heard). */
  audible: AudibleTrackResolver;
  /**
   * Fires due timers (the resolver's song boundary). Called on every native
   * progress reading: on Android, JS timers do not run in the background.
   */
  pump?: () => void;
  now?: () => number;
}

/**
 * What the listener hears and how far into it — the app's one answer, from
 * two independent sources.
 *
 * - **ICY titles** ({@link HeardTrack}) are the truth at every song change:
 *   the title sits at the song's start in the audio on every mount (measured,
 *   including the transcoded ones) and the player reports it when it plays.
 * - At a **tune-in** the title says which song, but not how far into it. That
 *   comes from the audible clock once it has settled: the first title plays
 *   at once, while the player may still be loading the connect burst (seen
 *   on Android: 4.8 s buffered of the 17 s actually behind the edge), so a
 *   single lag reading taken then is too early. The stream's calibration
 *   (see {@link HeardTrack.tuneInBiasMs}) corrects it further.
 * - **The audible clock** ({@link StreamSyncEngine} + {@link AudibleTrackResolver}),
 *   the pre-ICY model: station time minus the measured lag. It drives the
 *   display when a stream carries no titles, so the app never depends on one
 *   source alone.
 */
export class NowHearing {
  /** The displayed track, its position or the source changed. */
  onChange: () => void = () => {};

  private titleHeard = false;
  private playingSince: number | null = null;
  private lastMode: "icy" | "clock" = "icy";
  private lastAnchored = false;
  private readonly now: () => number;

  constructor(private readonly deps: NowHearingDeps) {
    this.now = deps.now ?? Date.now;
    deps.audible.onChange = () => {
      if (this.mode === "clock") this.onChange();
    };
  }

  /** Which source drives the display. */
  get mode(): "icy" | "clock" {
    if (this.titleHeard || this.playingSince == null) return "icy";
    return this.now() - this.playingSince >= ICY_MISSING_MS ? "clock" : "icy";
  }

  get track(): Track | null {
    if (this.mode === "clock") return this.deps.audible.track ?? this.deps.heard.track;
    return this.deps.heard.track;
  }

  /** Whether the position is known (a title heard / the clock settled). */
  get anchored(): boolean {
    const { heard, sync } = this.deps;
    if (this.mode === "clock") return sync.settled;
    return heard.anchored && (!heard.estimated || sync.settled);
  }

  /**
   * Where {@link track} is, as a fixed point the UI and the lock screen
   * extrapolate in real time — `null` while unknown. Every source ends up
   * here as wall-clock seconds: a heard title anchors at its change, and a
   * computed position (tune-in, no ICY) comes off the *locked* audible clock.
   * So once known it only moves at real events (a title, pause / resume, a
   * re-open), never with the jitter of the lag readings.
   */
  position(): TrackPosition | null {
    const { heard, audible } = this.deps;
    if (this.mode === "clock") return this.clockPosition(audible.track, 0);
    if (!heard.estimated) return heard.position;
    return heard.anchored ? this.clockPosition(heard.track, heard.tuneInBiasMs) : null;
  }

  /** Elapsed ms into {@link track} right now, or `null` when unknown / not within it. */
  elapsedMs(): number | null {
    const position = this.position();
    const track = this.track;
    if (!position || !track) return null;
    const elapsed = positionAt(position, this.now());
    if (elapsed < 0) return null;
    if (track.duration > 0 && elapsed > track.duration) return null;
    return elapsed;
  }

  /** `track` on the locked audible clock, less a calibration (ms). */
  private clockPosition(track: Track | null, biasMs: number): TrackPosition | null {
    const anchor = this.deps.sync.settled ? this.deps.sync.anchor : null;
    const start = track?.startTime?.getTime();
    if (!anchor || start == null || !Number.isFinite(start)) return null;
    return {
      elapsedMs: anchor.stationMs - biasMs - start,
      at: anchor.at,
      running: anchor.running,
    };
  }

  /** A native progress reading (Airwave `progress` events, ~1 Hz while playing). */
  progress(reading: LagReading): void {
    const { sync, heard } = this.deps;
    const lockBefore = sync.anchor;
    sync.updateFromStatus({
      isLive: true,
      offsetFromLive: reading.liveOffset,
      bufferedAheadSeconds: reading.bufferedAhead,
    });
    this.deps.pump?.();
    this.deps.audible.adoptIfDue();
    const reported = this.checkMode();
    // A re-lock moved a clock-driven position: the lock screen follows.
    const clockDriven = this.mode === "clock" || heard.estimated;
    const relocked = lockBefore != null && lockBefore.stationMs !== sync.anchor?.stationMs;
    if (!reported && clockDriven && relocked) this.onChange();
  }

  /** An ICY title was heard (after {@link HeardTrack.heard}). */
  titleWasHeard(): void {
    this.titleHeard = true;
    this.checkMode();
  }

  setPlaying(playing: boolean): void {
    if (playing) this.playingSince ??= this.now();
    this.deps.sync.setRunning(playing, this.now());
    this.checkMode();
  }

  /** The station announced something. */
  stationChanged(): void {
    if (this.deps.audible.reconcile() && this.mode === "clock") this.onChange();
  }

  /** The source (re)opened: both sources re-measure. */
  reopened(): void {
    this.titleHeard = false;
    this.playingSince = null;
    this.deps.sync.reset();
    this.deps.audible.beginReacquire();
    this.checkMode();
  }

  /** HTTP `date` skew sample, for both sources. */
  setClockSkew(skewMs: number, rttMs: number): void {
    this.deps.heard.setClockSkew(skewMs, rttMs);
    this.deps.sync.setClockSkew(skewMs, rttMs);
  }

  reset(): void {
    this.titleHeard = false;
    this.playingSince = null;
    this.lastMode = "icy";
    this.lastAnchored = false;
    this.deps.heard.reset();
    this.deps.sync.reset();
    this.deps.audible.reset();
  }

  /** Fires {@link onChange} when the source or its settling changed; returns whether it did. */
  private checkMode(): boolean {
    const { mode, anchored } = this;
    const modeChanged = mode !== this.lastMode;
    // The clock settling gives the position: the lock screen needs it too.
    // (A heard change reports itself, through HeardTrack.)
    const clockDriven = mode === "clock" || this.deps.heard.estimated;
    const settled = clockDriven && anchored !== this.lastAnchored;
    this.lastMode = mode;
    this.lastAnchored = anchored;
    if (modeChanged && mode === "clock") this.deps.audible.reconcile();
    if (modeChanged || settled) this.onChange();
    return modeChanged || settled;
  }
}

/** Elapsed ms of `position` at wall clock `now`. */
export const positionAt = (position: TrackPosition, now: number): number =>
  position.elapsedMs + (position.running ? Math.max(0, now - position.at) : 0);

