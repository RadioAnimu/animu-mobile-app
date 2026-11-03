import { parseNowPlayingTitle } from "animu-api";
import type { Track } from "@/core/domain/track";
import { trackStartMs } from "@/core/player/stream-playback/track-start";

/**
 * How long after the API's `timestart` the station's ICY title changes
 * (measured: median 1.18 s, range 0.34–1.85 s; `timestart` has one-second
 * resolution). The station's timeline, not the audio's: see
 * {@link icyTitleInItemMs}.
 */
const ICY_AFTER_START_MS = 1_200;
/** `icy-metaint` of every station mount: audio bytes between metadata blocks. */
const ICY_METAINT_BYTES = 16_000;

/**
 * How far into an item (ms) its ICY title is heard, on average, on a mount
 * of `bitrateKbps`. Icecast sends the title at the next metadata block of
 * each connection (every {@link ICY_METAINT_BYTES} bytes), so it lands 0…1
 * block into the item: half a block on average, 0.2 s at 320 kbps and 1 s at
 * 64 kbps (recorded mounts agree with this model to ~0.1 s).
 */
export function icyTitleInItemMs(bitrateKbps: number): number {
  const blockMs = (ICY_METAINT_BYTES * 8) / bitrateKbps;
  return Math.round(blockMs / 2);
}

/** The station's main mount, assumed until a stream is chosen. */
const DEFAULT_BITRATE_KBPS = 320;
/**
 * How far the station's clock runs ahead of its audio (ms), ~1 s: the
 * tune-in bias until a stream has calibrated its own.
 */
export const STATION_AHEAD_OF_AUDIO_MS = ICY_AFTER_START_MS - icyTitleInItemMs(DEFAULT_BITRATE_KBPS);
/**
 * A tune-in's position is computed (station time minus the lag), not heard.
 * Each title change heard later shows how far that is off on this stream;
 * the median of the recent ones corrects the next tune-in.
 */
const CALIBRATION_WINDOW = 9;
/** A sample this far off is the API's `timestart` being wrong (live shows, jingles). */
const CALIBRATION_MAX_MS = 15_000;
/**
 * A position this far (ms) off the player's media clock is moved onto it
 * ({@link HeardTrack.alignToMedia}): readings agree to ±6 ms, a late-handled
 * pause leaves ~0.1 s.
 */
export const MEDIA_ALIGN_MS = 60;

/** A title for the second matching pass: what encoders and databases disagree on is folded. */
const matchKey = (title: string): string =>
  (typeof title.normalize === "function" ? title.normalize("NFC") : title)
    .replace(/\\(['"])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
};

/**
 * Where the heard track is: `elapsedMs` into it at wall clock `at`, advancing
 * in real time from there while `running`.
 */
export interface TrackPosition {
  /** Elapsed ms into the track at `at`. */
  readonly elapsedMs: number;
  /** `Date.now()` of the anchor. */
  readonly at: number;
  /** Advancing (audio flowing) since `at`. */
  readonly running: boolean;
}

/** Where the display's position comes from. */
interface Anchor extends TrackPosition {
  /** Computed at a tune-in, not heard at a change. */
  estimated: boolean;
}

export interface HeardTrackOptions {
  /** Tracks the station has announced, newest first (current + recent history). */
  candidates: () => readonly (Track | null | undefined)[];
  /** The station's current track (shown before the first ICY title is heard). */
  stationTrack: () => Track | null;
  /** The applied server-vs-device clock offset (ms): the sync engine's. */
  clockSkew?: () => number;
  now?: () => number;
}

/**
 * What the listener is hearing right now, and how far into it.
 *
 * The player delivers each ICY title when it becomes **audible**, and the
 * station changes it as a track starts, so a heard change *is* "this track
 * just started": the displayed track is the API track whose `raw` is the
 * title, placed at {@link icyTitleInItemMs}.
 *
 * Only the *first* title after a (re)open is estimated: that track is
 * already partway, so its position is the station clock minus the lag,
 * corrected by {@link CALIBRATION_WINDOW}. The next boundary is exact again.
 */
export class HeardTrack {
  /** The displayed track changed (title, cover, position). */
  onChange: () => void = () => {};
  /**
   * A heard title the station data does not name (yet). The owner fetches
   * fresh data over HTTP (no JS timer: none fires in the Android background),
   * then calls {@link unresolved} if it is still unknown.
   */
  onUnknownTitle: (title: string) => void = () => {};

  private displayed: Track | null = null;
  private anchor: Anchor | null = null;
  /** A heard title the API has not named yet (resolved by `stationChanged`). */
  private pending: { title: string; heardAt: number; tuneIn: boolean; lagMs: number } | null = null;
  /** Wall ms the station last announced an item (0 = not since the reset). */
  private stationChangedAt = 0;
  /** Per stream: how far the computed position was ahead of the heard one (ms). */
  private readonly calibration = new Map<string, number[]>();
  private stream = "";
  /** Where this mount's titles are heard in their item (ms). */
  private titleInItemMs = icyTitleInItemMs(DEFAULT_BITRATE_KBPS);
  /** The anchor on the player's media clock: elapsed ms at a media position (ms). */
  private media: { positionMs: number; elapsedMs: number } | null = null;
  private readonly now: () => number;

  constructor(private readonly options: HeardTrackOptions) {
    this.now = options.now ?? Date.now;
  }

  /** The track to display: the heard one, else the station's current. */
  get track(): Track | null {
    return this.displayed ?? this.options.stationTrack();
  }

  /**
   * The position was computed at a tune-in, not heard. Its lag reading can
   * be early (the connect burst still loading): prefer a settled clock.
   */
  get estimated(): boolean {
    return this.anchor?.estimated ?? false;
  }

  /** Whether the position is known (a title was heard since the last open). */
  get anchored(): boolean {
    return this.anchor != null;
  }

  /** The position as a fixed point, or `null` before a title was heard; the same object until it moves. */
  get position(): TrackPosition | null {
    const anchor = this.anchor;
    if (!anchor || !this.displayed) return null;
    return anchor;
  }

  /** How far this stream's computed (tune-in) position runs ahead of the audio (ms). */
  get tuneInBiasMs(): number {
    const samples = this.calibration.get(this.stream);
    return samples?.length ? median(samples) : STATION_AHEAD_OF_AUDIO_MS;
  }

  /** The station's current track (what it announced last). */
  get stationTrack(): Track | null {
    return this.options.stationTrack();
  }

  /** A heard title still awaits its name (or shows as itself) and nothing newer was announced. */
  get awaitingStation(): boolean {
    return this.pending != null && !this.supersededByStation();
  }

  /** Whether the heard track played past its length; an unnamed title is over once a later item is announced. */
  pastEnd(now: number = this.now()): boolean {
    const anchor = this.anchor;
    const track = this.displayed;
    if (!anchor || !track) return false;
    if (track.duration <= 0) return this.supersededByStation();
    const elapsed = anchor.elapsedMs + (anchor.running ? Math.max(0, now - anchor.at) : 0);
    return elapsed > track.duration;
  }

  /** The stream played: its own calibration, and its bitrate places its titles. */
  useStream(key: string, bitrateKbps: number = DEFAULT_BITRATE_KBPS): void {
    this.stream = key;
    this.titleInItemMs = icyTitleInItemMs(bitrateKbps > 0 ? bitrateKbps : DEFAULT_BITRATE_KBPS);
  }

  /** Elapsed ms into {@link track}, or `null` when unknown / past its end. */
  elapsedMs(now: number = this.now()): number | null {
    const anchor = this.anchor;
    const track = this.displayed;
    if (!anchor || !track) return null;
    const elapsed = anchor.elapsedMs + (anchor.running ? Math.max(0, now - anchor.at) : 0);
    if (track.duration > 0 && elapsed > track.duration) return null;
    return elapsed;
  }

  /**
   * An ICY title became audible.
   * @param tuneIn first title since the source (re)opened — already partway.
   * @param lagMs how far the speaker trails the live edge.
   */
  heard(title: string, heardAt: number, tuneIn: boolean, lagMs: number): void {
    const wanted = title.trim();
    if (!wanted) return;
    if (!tuneIn && this.displayed?.raw.trim() === wanted) return;
    const track = this.find(wanted);
    if (!track) {
      // ICY can reach the speaker before the API names the track: wait for it.
      this.pending = { title: wanted, heardAt, tuneIn, lagMs };
      this.onUnknownTitle(wanted);
      return;
    }
    this.adopt(track, heardAt, tuneIn, lagMs);
  }

  /**
   * Fresh data still does not name the heard title (API late, a live show's
   * own title): show the title itself, not a song that already ended, until
   * the station names it.
   */
  unresolved(title: string): void {
    const pending = this.pending;
    if (pending?.title !== title) return;
    const { title: name, artist, anime } = parseNowPlayingTitle(title);
    const heard = {
      id: "0",
      raw: title,
      title: name,
      artist,
      anime,
      artworks: {},
      artwork: "",
      duration: 0,
      isRequest: false,
      startTime: new Date(pending.heardAt - ICY_AFTER_START_MS),
      playlistName: "",
    } as Track;
    // Keep `pending`: `stationChanged` upgrades to the real track.
    const keep = pending;
    this.adopt(heard, pending.heardAt, pending.tuneIn, pending.lagMs, false);
    this.pending = keep;
  }

  /** The station announced something: a pending heard title may now resolve. */
  stationChanged(): void {
    this.stationChangedAt = this.now();
    if (this.displayed == null) this.onChange();
    const pending = this.pending;
    // A shown fallback title (see `unresolved`) still counts as pending.
    if (!pending) return;
    const track = this.find(pending.title);
    if (track) this.adopt(track, pending.heardAt, pending.tuneIn, pending.lagMs);
  }

  /**
   * Keeps the position on the player's media clock: a stall or pause stops
   * the anchor when *handled* (late on a busy JS thread), while the media
   * position only advances with the audio. The first reading after placing
   * is the reference; past {@link MEDIA_ALIGN_MS} the position moves onto
   * it. Returns whether it moved.
   */
  alignToMedia(positionS: number, atMs: number): boolean {
    const anchor = this.anchor;
    if (!anchor || !this.displayed || !Number.isFinite(positionS) || !Number.isFinite(atMs)) return false;
    const positionMs = positionS * 1000;
    const elapsed = anchor.elapsedMs + (anchor.running ? Math.max(0, atMs - anchor.at) : 0);
    const reference = this.media;
    // No reference yet, or the media clock restarted (a new connection).
    if (!reference || positionMs < reference.positionMs) {
      this.media = { positionMs, elapsedMs: elapsed };
      return false;
    }
    const expected = reference.elapsedMs + (positionMs - reference.positionMs);
    if (Math.abs(expected - elapsed) <= MEDIA_ALIGN_MS) return false;
    this.anchor = { elapsedMs: expected, at: atMs, running: anchor.running, estimated: anchor.estimated };
    return true;
  }

  /** Audio flowing or not: the position advances only while it flows. */
  setRunning(running: boolean, now: number = this.now()): void {
    const anchor = this.anchor;
    if (!anchor || anchor.running === running) return;
    this.anchor = {
      elapsedMs: anchor.elapsedMs + (anchor.running ? Math.max(0, now - anchor.at) : 0),
      at: now,
      running,
      estimated: anchor.estimated,
    };
  }

  /** The source (re)opened: the next title is a tune-in; the track on screen stays meanwhile. */
  reopened(): void {
    this.anchor = null;
    this.media = null;
    this.pending = null;
  }

  /**
   * The listening session is over (a long pause): back to the station's
   * track, nothing heard. Unlike {@link reopened}, nothing on screen is kept.
   * The stream and its calibration survive.
   */
  abandon(): void {
    this.displayed = null;
    this.anchor = null;
    this.media = null;
    this.pending = null;
  }

  private get skewMs(): number {
    return this.options.clockSkew?.() ?? 0;
  }

  reset(): void {
    this.displayed = null;
    this.anchor = null;
    this.media = null;
    this.pending = null;
    this.stationChangedAt = 0;
  }

  private calibrate(sample: number): void {
    if (Math.abs(sample) > CALIBRATION_MAX_MS) return;
    const samples = this.calibration.get(this.stream) ?? [];
    this.calibration.set(this.stream, [...samples, sample].slice(-CALIBRATION_WINDOW));
  }

  /**
   * The unnamed heard title was moved past: an item announced after it
   * starts later on the station timeline than the title's audio (a late
   * announcement of an earlier item does not count).
   */
  private supersededByStation(): boolean {
    const pending = this.pending;
    if (!pending || this.stationChangedAt <= pending.heardAt) return false;
    const start = trackStartMs(this.options.stationTrack());
    if (start == null) return false;
    return start > pending.heardAt + this.skewMs - Math.max(0, pending.lagMs);
  }

  /** The candidate whose `raw` is `title`: exactly, else on {@link matchKey}. */
  private find(title: string): Track | null {
    const candidates = this.options.candidates();
    for (const track of candidates) {
      if (track?.raw.trim() === title) return track;
    }
    const key = matchKey(title);
    for (const track of candidates) {
      if (track && matchKey(track.raw) === key) return track;
    }
    return null;
  }

  private adopt(
    track: Track,
    heardAt: number,
    tuneIn: boolean,
    lagMs: number,
    fromStation = true,
  ): void {
    this.pending = null;
    // Station time when heard, minus the lag: places a tune-in, and at a
    // change (the heard title being the truth) calibrates that.
    const start = track.startTime.getTime();
    const stationElapsed = Number.isFinite(start)
      ? heardAt + this.skewMs - start - Math.max(0, lagMs)
      : null;
    if (!tuneIn && fromStation && stationElapsed != null) {
      this.calibrate(stationElapsed - this.titleInItemMs);
    }
    let elapsed = this.titleInItemMs;
    if (tuneIn && stationElapsed != null) elapsed = stationElapsed - this.tuneInBiasMs;
    if (track.duration > 0) elapsed = Math.min(elapsed, track.duration);
    const now = this.now();
    this.media = null;
    this.anchor = {
      elapsedMs: Math.max(0, elapsed) + Math.max(0, now - heardAt),
      at: now,
      running: true,
      estimated: tuneIn,
    };
    this.displayed = track;
    this.onChange();
  }
}
