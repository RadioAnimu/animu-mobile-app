import type { Track } from "@/core/domain/track";
import type { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import type { HeardTrack } from "@/core/player/stream-playback/heard-track";
import {
  getSyncedTrackProgress,
  type StreamSyncEngine,
} from "@/core/player/stream-playback/stream-sync";

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

  /** Elapsed ms into {@link track}, or `null` when unknown / past its end. */
  elapsedMs(): number | null {
    const { heard, audible } = this.deps;
    if (this.mode === "clock") return this.clockElapsed(audible.track, 0);
    if (!heard.estimated) return heard.elapsedMs();
    return heard.anchored ? this.clockElapsed(heard.track, heard.tuneInBiasMs) : null;
  }

  /** `track`'s position on the settled audible clock, less a calibration (ms). */
  private clockElapsed(track: Track | null, biasMs: number): number | null {
    if (!this.deps.sync.settled) return null;
    return getSyncedTrackProgress(track, this.deps.sync.now() - biasMs).elapsedMs;
  }

  /** A native progress reading (Airwave `progress` events, ~1 Hz while playing). */
  progress(reading: LagReading): void {
    this.deps.sync.updateFromStatus({
      isLive: true,
      offsetFromLive: reading.liveOffset,
      bufferedAheadSeconds: reading.bufferedAhead,
    });
    this.deps.pump?.();
    this.deps.audible.adoptIfDue();
    this.checkMode();
  }

  /** An ICY title was heard (after {@link HeardTrack.heard}). */
  titleWasHeard(): void {
    this.titleHeard = true;
    this.checkMode();
  }

  setPlaying(playing: boolean): void {
    if (playing) this.playingSince ??= this.now();
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

  private checkMode(): void {
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
  }
}
