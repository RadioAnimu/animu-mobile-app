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
/**
 * The heard track is past its own length and a different station item has
 * been audible on the settled clock this long: its ICY title never reached
 * the player (dropped, or the station did not send it). Far past the normal
 * 1.2 s, and past any lag misreading, so it only catches a title that is not
 * coming — the display shows the station's item until the next title.
 */
export const ICY_OVERDUE_MS = 30_000;
/**
 * A paused listener keeps the frozen song on screen this long (ms) before the
 * display follows the station again. UX hysteresis, not a prediction: it
 * mirrors Airwave's `liveMaxDriftMs` (5 s), the pause after which a resume
 * re-opens at the live edge instead of in place — the paused position would
 * not be resumed past it. Airwave adds the drift it has accumulated over
 * earlier pauses to the pause itself, so it can re-open sooner than this; the
 * app only needs the display not to flicker through a brief pause.
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
 * - **The station's live point** (`station` mode) when there is no audio to
 *   follow and none wanted: a cold start, a long pause, a stopped or failed
 *   player. The display shows what the station is playing, on its own clock
 *   corrected by the server skew — not what is audible (nothing is), so it is
 *   never counted as heard (see {@link anchored}), but the bar, countdown and
 *   lyrics clock keep moving with the music on air.
 *
 * Play intent decides between them. While audio flows, or is wanted (the
 * player is acquiring it), the audio sources above drive. Without either,
 * the display is the station's — at once when nothing was heard or the
 * player was torn down, after {@link STATION_AFTER_PAUSE_MS} when merely
 * paused with a position to resume.
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
   * Whether the display follows the station rather than the audio: no audio
   * flows or is wanted, and either nothing can be resumed or the pause has
   * outlasted {@link STATION_AFTER_PAUSE_MS}. Not `playingSince == null`: a
   * re-open clears that during a legitimate acquisition.
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
   * Whether the position is known *and audible* (a title heard / the clock
   * settled). Never true in `station` mode, whose position is the station's
   * live point, not what reaches the speaker: listen stats and the "syncing"
   * state are keyed on this. See {@link positionKnown} for the display's.
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
   * extrapolate in real time — `null` while unknown. Every source ends up
   * here as wall-clock seconds: a heard title anchors at its change, and a
   * computed position (tune-in, no ICY) comes off the *locked* audible clock.
   * So once known it only moves at real events (a title, pause / resume, a
   * re-open), never with the jitter of the lag readings.
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
   * The station's item, when the ICY title for it is overdue (see
   * {@link ICY_OVERDUE_MS}): the heard track is over, and the station's has
   * been audible a while and not ended. A heard title still waiting for the
   * station (or shown as itself) is newer information: it keeps the display.
   */
  private overdue(): Track | null {
    const { heard, sync } = this.deps;
    if (this.mode !== "icy" || heard.awaitingStation || !heard.pastEnd()) return null;
    if (!sync.settled) return null;
    const station = heard.stationTrack;
    const start = station?.startTime?.getTime();
    if (!station || start == null || !Number.isFinite(start)) return null;
    if (station.raw === heard.track?.raw) return null;
    const audibleFor = sync.now() - start;
    if (audibleFor < ICY_OVERDUE_MS) return null;
    if (station.duration > 0 && audibleFor > station.duration) return null;
    return station;
  }

  /**
   * The station's current item at its live point: server time (the device
   * clock plus the applied skew) minus its `startTime`. A fixed point per
   * (track, skew) — recomputed only when either changes, so the stores see
   * the same anchor tick after tick and the UI advances it itself. An item
   * not started yet (the device clock behind the server's by less than the
   * skew threshold, or an announcement ahead of air) holds at 0 until it
   * does; one past its length is held at its end by the consumers until the
   * station announces the next. `null` without a usable `startTime`.
   */
  private stationPosition(): TrackPosition | null {
    const track = this.deps.heard.stationTrack;
    const start = track?.startTime?.getTime();
    if (!track || start == null || !Number.isFinite(start)) return null;
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
    const start = track?.startTime?.getTime();
    if (!anchor || start == null || !Number.isFinite(start)) return null;
    return {
      elapsedMs: anchor.stationMs - biasMs - start,
      at: anchor.at,
      running: anchor.running,
    };
  }

  /**
   * How far the speaker trails the live edge right now (ms), for a heard
   * title: the locked clock's lag once it has settled — what a tune-in's
   * position is computed from, so a change heard calibrates exactly that —
   * else `readingMs`, the player's own reading.
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
    // A re-lock or a media-clock correction moved the position: the lock
    // screen follows.
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
   * Whether audio is wanted (a play asked for, or the player will play when
   * ready) and whether the player holds its place (`resumable`: paused or
   * pausing, so a resume continues the song). Dropping the intent starts the
   * pause's {@link STATION_AFTER_PAUSE_MS}; repeating it does not restart it.
   */
  setIntent(wanted: boolean, resumable = false): void {
    if (this.wanted && !wanted) this.idleSince = this.now();
    this.wanted = wanted;
    this.resumable = resumable;
    this.checkMode();
  }

  /**
   * Re-evaluates the mode against the clock: a pause outlasting
   * {@link STATION_AFTER_PAUSE_MS} flips it with no other event. For the
   * foreground tick and a return to the foreground.
   */
  recheck(): void {
    this.checkMode();
  }

  /**
   * The station announced something. In station mode the display is the
   * station's own track, and the change is reported by its owner:
   * {@link HeardTrack} holds no display then (see {@link HeardTrack.abandon}),
   * so its `stationChanged` fires the one `onChange` — reporting here as well
   * would push the lock screen twice for a single change.
   */
  stationChanged(): void {
    const station = this.mode === "station";
    // The audible resolver is for the audio's clock: not fed in station mode.
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

  /** HTTP `date` skew sample, for both sources. */
  setClockSkew(skewMs: number, rttMs: number): void {
    const before = this.deps.sync.clockSkew;
    this.deps.heard.setClockSkew(skewMs, rttMs);
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
   * The display moves on to the station: whatever the last listening session
   * left is dropped, so nothing of it can come back when audio is wanted
   * again — the station's track stays as the placeholder until the open
   * places the song (see {@link HeardTrack.abandon}; the resolver's retained
   * track would otherwise be held through the re-acquisition).
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
    // The clock settling gives the position: the lock screen needs it too.
    // (A heard change reports itself, through HeardTrack.)
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

