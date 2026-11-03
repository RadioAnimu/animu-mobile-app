import type { Track } from "@/core/domain/track";
import type { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import type { HeardTrack, TrackPosition } from "@/core/player/stream-playback/heard-track";
import type { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { trackStartMs } from "@/core/player/stream-playback/track-start";

/**
 * Playing this long without an ICY title means the stream carries none (the
 * 64 kbps mount's first block is 2 s in): the audible clock takes over.
 */
export const ICY_MISSING_MS = 12_000;
/**
 * The heard track is past its length and another station item has been
 * audible this long: its title is not coming (dropped, never sent), so the
 * station's item shows until the next title. Far past any lag misreading.
 */
export const ICY_OVERDUE_MS = 30_000;
/**
 * A paused song stays on screen this long (ms) before the display follows the
 * station. Mirrors Airwave's `liveMaxDriftMs`, past which a resume re-opens
 * at the live edge; it only keeps a brief pause from flickering.
 */
export const STATION_AFTER_PAUSE_MS = 5_000;

/** Which source drives the display (see {@link NowHearing}). */
export type HearingMode = "icy" | "clock" | "station";

/** A native progress reading (seconds), as Airwave reports it. */
export interface LagReading {
  liveOffset: number | null;
  bufferedAhead: number;
  /** The player's media position (s) — the audio's own clock. */
  position?: number;
  /** Epoch ms the reading was taken at. */
  timestamp?: number;
}

export interface NowHearingDeps {
  /** What ICY says is heard (the station's titles, at the moment they play). */
  heard: HeardTrack;
  /** The audible station clock: wall clock minus the measured lag. */
  sync: StreamSyncEngine;
  /** The station's track on the audible clock (holds the previous until heard). */
  audible: AudibleTrackResolver;
  /** Fires due timers (the song boundary) on each native reading: Android freezes JS timers in the background. */
  pump?: () => void;
  now?: () => number;
}

/**
 * What the listener hears and how far into it — the app's one answer.
 *
 * - **ICY titles** ({@link HeardTrack}) are the truth at every song change.
 * - At a **tune-in** the title names the song; how far into it comes from the
 *   settled audible clock, since the first lag reading can be taken while the
 *   connect burst still loads (4.8 s buffered of 17 s behind, on Android).
 * - **The audible clock** ({@link StreamSyncEngine} +
 *   {@link AudibleTrackResolver}) drives when a stream carries no titles.
 * - **The station's live point** (`station` mode) with no audio flowing or
 *   wanted (cold start, long pause, failed player): what is on air, never
 *   counted as heard ({@link anchored}), while the bar and lyrics keep moving.
 *
 * While audio flows or is wanted, the audio sources drive. Otherwise the
 * station does: at once with nothing to resume, after
 * {@link STATION_AFTER_PAUSE_MS} for a pause.
 */
export class NowHearing {
  /** The displayed track, its position or the source changed. */
  onChange: () => void = () => {};

  private titleHeard = false;
  private playingSince: number | null = null;
  /** Audio is flowing (the player is `playing`). */
  private flowing = false;
  /** Audio is wanted: a play was asked for, or the player will play when ready. */
  private wanted = false;
  /** The player holds its place (paused, or pausing): a resume continues the song. */
  private resumable = false;
  /** When the play intent last dropped (starts {@link STATION_AFTER_PAUSE_MS}). */
  private idleSince = 0;
  /** The station's position for one (track, skew): the same object until either changes. */
  private stationAnchor: { key: string; position: TrackPosition } | null = null;
  private lastMode: HearingMode = "station";
  private lastAnchored = false;
  private lastOverdue: string | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: NowHearingDeps) {
    this.now = deps.now ?? Date.now;
    deps.audible.onChange = () => {
      if (this.mode === "clock") this.onChange();
    };
  }

  /** Which source drives the display. */
  get mode(): HearingMode {
    return this.isStation() ? "station" : this.driver();
  }

  /** The audio source in use while the display follows the audio. */
  private driver(): "icy" | "clock" {
    if (this.titleHeard || this.playingSince == null) return "icy";
    return this.now() - this.playingSince >= ICY_MISSING_MS ? "clock" : "icy";
  }

  /**
   * Whether the display follows the station (see the class doc). Not
   * `playingSince == null`: a re-open clears that during an acquisition.
   */
  private isStation(): boolean {
    if (this.flowing || this.wanted) return false;
    if (!this.resumable || !this.holdsPosition()) return true;
    return this.now() - this.idleSince >= STATION_AFTER_PAUSE_MS;
  }

  /** A paused position worth keeping on screen: one was heard or computed. */
  private holdsPosition(): boolean {
    const { heard, sync } = this.deps;
    return heard.anchored || (this.driver() === "clock" && sync.settled);
  }

  get track(): Track | null {
    const mode = this.mode;
    if (mode === "station") return this.deps.heard.stationTrack;
    if (mode === "clock") return this.deps.audible.track ?? this.deps.heard.track;
    return this.overdue() ?? this.deps.heard.track;
  }

  /**
   * Whether the position is known *and audible*: never in `station` mode.
   * Listen stats and "syncing" key on this; the display on {@link positionKnown}.
   */
  get anchored(): boolean {
    const { heard, sync } = this.deps;
    const mode = this.mode;
    if (mode === "station") return false;
    if (mode === "clock" || this.overdue()) return sync.settled;
    return heard.anchored && (!heard.estimated || sync.settled);
  }

  /** Whether {@link position} is known — audible or, in `station` mode, the station's. */
  get positionKnown(): boolean {
    return this.mode === "station" ? this.position() != null : this.anchored;
  }

  /**
   * Where {@link track} is, as a fixed point the UI and the lock screen
   * extrapolate — `null` while unknown. Heard titles and the *locked* clock
   * only move it at real events, never with reading jitter.
   */
  position(): TrackPosition | null {
    const { heard, audible } = this.deps;
    const mode = this.mode;
    if (mode === "station") return this.stationPosition();
    if (mode === "clock") return this.clockPosition(audible.track, 0);
    const overdue = this.overdue();
    if (overdue) return this.clockPosition(overdue, heard.tuneInBiasMs);
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

  /**
   * The station's item when its title is overdue ({@link ICY_OVERDUE_MS}).
   * A heard title still awaiting its name is newer and keeps the display.
   */
  private overdue(): Track | null {
    const { heard, sync } = this.deps;
    if (this.mode !== "icy" || heard.awaitingStation || !heard.pastEnd()) return null;
    if (!sync.settled) return null;
    const station = heard.stationTrack;
    const start = trackStartMs(station);
    if (!station || start == null) return null;
    if (station.raw === heard.track?.raw) return null;
    const audibleFor = sync.now() - start;
    if (audibleFor < ICY_OVERDUE_MS) return null;
    if (station.duration > 0 && audibleFor > station.duration) return null;
    return station;
  }

  /**
   * The station's item at its live point (server time minus `startTime`),
   * one fixed point per (track, skew) so the stores see the same anchor. An
   * item not started yet holds at 0; `null` without a usable `startTime`.
   */
  private stationPosition(): TrackPosition | null {
    const track = this.deps.heard.stationTrack;
    const start = trackStartMs(track);
    if (!track || start == null) return null;
    const skew = this.deps.sync.clockSkew;
    const key = `${track.raw}\n${start}\n${skew}`;
    if (this.stationAnchor?.key !== key) {
      const now = this.now();
      const elapsedMs = now + skew - start;
      this.stationAnchor = {
        key,
        position:
          elapsedMs >= 0
            ? { elapsedMs, at: now, running: true }
            : { elapsedMs: 0, at: start - skew, running: true },
      };
    }
    return this.stationAnchor.position;
  }

  /** `track` on the locked audible clock, less a calibration (ms). */
  private clockPosition(track: Track | null, biasMs: number): TrackPosition | null {
    const anchor = this.deps.sync.settled ? this.deps.sync.anchor : null;
    const start = trackStartMs(track);
    if (!anchor || start == null) return null;
    return {
      elapsedMs: anchor.stationMs - biasMs - start,
      at: anchor.at,
      running: anchor.running,
    };
  }

  /**
   * How far the speaker trails the live edge (ms) for a heard title: the
   * locked lag once settled (what tune-ins use, so changes calibrate it),
   * else the player's `readingMs`.
   */
  lagMs(readingMs: number): number {
    const { sync } = this.deps;
    return (sync.settled ? sync.lockedLag : null) ?? readingMs;
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
    // Both positions follow the audio's own clock (see `alignToMedia`).
    let heardMoved = false;
    if (reading.position != null && reading.timestamp != null) {
      sync.alignToMedia(reading.position, reading.timestamp);
      heardMoved = heard.alignToMedia(reading.position, reading.timestamp);
    }
    this.deps.pump?.();
    this.deps.audible.adoptIfDue();
    const reported = this.checkMode();
    // A re-lock or media-clock correction moved the position: report it.
    const clockDriven = this.mode === "clock" || heard.estimated || this.overdue() != null;
    const relocked = lockBefore != null && lockBefore.stationMs !== sync.anchor?.stationMs;
    if (!reported && (clockDriven ? relocked : heardMoved)) this.onChange();
  }

  /** An ICY title was heard (after {@link HeardTrack.heard}). */
  titleWasHeard(): void {
    this.titleHeard = true;
    this.checkMode();
  }

  /** Audio started or stopped flowing. Flowing audio is wanted audio. */
  setPlaying(playing: boolean): void {
    this.flowing = playing;
    if (playing) {
      this.playingSince ??= this.now();
      this.wanted = true;
    }
    this.deps.sync.setRunning(playing, this.now());
    this.checkMode();
  }

  /**
   * Whether audio is wanted, and whether a resume would continue the song
   * (`resumable`). Dropping the intent starts {@link STATION_AFTER_PAUSE_MS};
   * repeating it does not restart it.
   */
  setIntent(wanted: boolean, resumable = false): void {
    if (this.wanted && !wanted) this.idleSince = this.now();
    this.wanted = wanted;
    this.resumable = resumable;
    this.checkMode();
  }

  /** Re-evaluates the mode: a pause outlasting {@link STATION_AFTER_PAUSE_MS} flips it with no event. */
  recheck(): void {
    this.checkMode();
  }

  /**
   * The station announced something. In station mode {@link HeardTrack}
   * reports it (it holds no display then); reporting here too would push the
   * lock screen twice.
   */
  stationChanged(): void {
    const station = this.mode === "station";
    const clockChanged = !station && this.deps.audible.reconcile() && this.mode === "clock";
    // An overdue display follows the station's item (or hands back to ICY).
    const reported = this.checkMode();
    if (clockChanged && !reported) this.onChange();
  }

  /** The source (re)opened: both sources re-measure. */
  reopened(): void {
    this.titleHeard = false;
    this.playingSince = null;
    this.deps.sync.reset();
    this.deps.audible.beginReacquire();
    this.checkMode();
  }

  /** HTTP `date` skew sample: the sync engine applies it, the heard track reads it. */
  setClockSkew(skewMs: number, rttMs: number): void {
    const before = this.deps.sync.clockSkew;
    this.deps.sync.setClockSkew(skewMs, rttMs);
    // The station's live point moves with the applied skew.
    if (this.mode === "station" && this.deps.sync.clockSkew !== before) this.onChange();
  }

  reset(): void {
    this.titleHeard = false;
    this.playingSince = null;
    this.flowing = false;
    this.wanted = false;
    this.resumable = false;
    this.idleSince = 0;
    this.stationAnchor = null;
    this.lastMode = "station";
    this.lastAnchored = false;
    this.lastOverdue = null;
    this.deps.heard.reset();
    this.deps.sync.reset();
    this.deps.audible.reset();
  }

  /**
   * The display moves on to the station: the last session's tracks are
   * dropped, so none comes back (held by the resolver) when audio is wanted
   * again.
   */
  private abandon(): void {
    this.titleHeard = false;
    this.playingSince = null;
    this.deps.heard.abandon();
    this.deps.audible.reset();
  }

  /**
   * Fires {@link onChange} when the source, its settling or an overdue
   * display changed; returns whether it did.
   */
  private checkMode(): boolean {
    const { mode, anchored } = this;
    const modeChanged = mode !== this.lastMode;
    if (modeChanged && mode === "station") this.abandon();
    // The clock settling gives the position (a heard change reports itself).
    const clockDriven = mode === "clock" || this.deps.heard.estimated;
    const settled = clockDriven && anchored !== this.lastAnchored;
    const overdue = this.overdue()?.raw ?? null;
    const overdueChanged = overdue !== this.lastOverdue;
    this.lastMode = mode;
    this.lastAnchored = anchored;
    this.lastOverdue = overdue;
    if (modeChanged && mode === "clock") this.deps.audible.reconcile();
    const changed = modeChanged || settled || overdueChanged;
    if (changed) this.onChange();
    return changed;
  }
}

/** Elapsed ms of `position` at wall clock `now`. */
export const positionAt = (position: TrackPosition, now: number): number =>
  position.elapsedMs + (position.running ? Math.max(0, now - position.at) : 0);

