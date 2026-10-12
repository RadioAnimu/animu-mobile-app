import { parseNowPlayingTitle } from "animu-api";
import type { Track } from "@/core/domain/track";

/**
 * How long after the API's `timestart` the station's ICY title changes.
 * Measured against the live stream: 67 consecutive changes over 3 hours
 * (2026-10-04) — min 0.34 s, median 1.18 s, max 1.85 s (`timestart` has
 * one-second resolution). The ICY title also matched the API `rawtitle`
 * byte for byte every time. This is the *station's* timeline, not the
 * audio's: see {@link icyTitleInItemMs} for where the title sits in the item.
 */
export const ICY_AFTER_START_MS = 1_200;
/** `icy-metaint` of every station mount: audio bytes between metadata blocks. */
export const ICY_METAINT_BYTES = 16_000;

/**
 * How far into an item (ms) its ICY title is heard, on average, on a mount
 * of `bitrateKbps`.
 *
 * The station writes the title at the item's first audio, but Icecast can
 * only send it at the next metadata block of each listener's connection —
 * every {@link ICY_METAINT_BYTES} bytes, counted from that connection's own
 * start. So the title is heard 0…1 block after the item began, uniformly:
 * on average half a block, 0.2 s on the 320 kbps mount and 1 s on the
 * 64 kbps one. Measured 2026-10-11 (all three mounts recorded at once,
 * their decoded audio cross-correlated; 11 changes): titles 0.14 s later on
 * 192 and 0.69 s later on 64 than on 320 (half-block model: 0.13 / 0.80);
 * on 320, jingles start 0–0.2 s before their title. Android's player
 * reports the title where it sits in the stream (within 0.04 s).
 */
export function icyTitleInItemMs(bitrateKbps: number): number {
  const blockMs = (ICY_METAINT_BYTES * 8) / bitrateKbps;
  return Math.round(blockMs / 2);
}

/** The station's main mount, assumed until a stream is chosen. */
const DEFAULT_BITRATE_KBPS = 320;
/**
 * How far the station's clock runs ahead of its audio (ms): the title
 * changes {@link ICY_AFTER_START_MS} after `timestart` and is heard half a
 * 320 kbps block into the item, so the item reached the stream ~1 s after
 * `timestart`. A tune-in's position (station time minus the lag) starts
 * from this until the stream has calibrated its own.
 */
export const STATION_AHEAD_OF_AUDIO_MS = ICY_AFTER_START_MS - icyTitleInItemMs(DEFAULT_BITRATE_KBPS);
/**
 * The tune-in position is computed, not heard: station time minus the
 * measured lag. Every title change heard afterwards shows how far that
 * computation is off on this stream (the station clock leading its audio,
 * a platform that under-reads the lag right after connecting); the median
 * of recent ones corrects the next tune-in.
 */
const CALIBRATION_WINDOW = 9;
/** A sample this far off is the API's `timestart` being wrong (live shows, jingles). */
const CALIBRATION_MAX_MS = 15_000;
/** A server clock correction is applied once its median reaches this (ms). */
const CLOCK_SKEW_APPLY_MS = 1_500;
/** Recent skew samples feeding the median. */
const SKEW_WINDOW = 9;
/** Skew samples with a longer round trip are too imprecise to use (ms). */
const SKEW_MAX_RTT_MS = 2_500;
/**
 * A position this far (ms) off the player's media clock is moved onto it
 * (see {@link HeardTrack.alignToMedia}). Readings agree to ±6 ms (measured
 * on Android); a pause or resume handled a beat late leaves ~0.1 s, which
 * this takes back.
 */
export const MEDIA_ALIGN_MS = 60;

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
  now?: () => number;
}

/**
 * What the listener is hearing right now, and how far into it.
 *
 * The player delivers each ICY title at the moment it becomes **audible**
 * (react-native-anything-player: AVPlayer's metadata output / Media3's metadata
 * renderer). The station changes that title ~1.2 s after a track starts, so
 * an ICY change *is* "this track just started, here": the displayed track is
 * the API track whose `raw` equals the title, at where the title is heard on
 * this mount ({@link icyTitleInItemMs}). No predictive track end.
 *
 * The one estimate left is the *first* title after tuning in (or re-opening
 * at the live edge): that track is already partway, so its position comes
 * from the station clock minus how far the speaker trails the live edge,
 * corrected by what this stream's heard title changes showed (see
 * {@link CALIBRATION_WINDOW}). It is exact again at the next track boundary.
 */
export class HeardTrack {
  /** The displayed track changed (title, cover, position). */
  onChange: () => void = () => {};
  /**
   * A heard title the station data does not name (yet). The owner fetches
   * fresh data — by an HTTP request, no JS timer: on Android none fires in the
   * background, and the SSE stream cannot reconnect there either — then calls
   * {@link unresolved} if the title is still unknown.
   */
  onUnknownTitle: (title: string) => void = () => {};

  private displayed: Track | null = null;
  private anchor: Anchor | null = null;
  /** A heard title the API has not named yet (resolved by `stationChanged`). */
  private pending: { title: string; heardAt: number; tuneIn: boolean; lagMs: number } | null = null;
  private skewSamples: number[] = [];
  private skewMs = 0;
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
   * The position was computed at a tune-in (station time minus a lag reading
   * taken the moment the first title played), not heard at a change. Right
   * after connecting that reading can be early: the player may still be
   * loading the connect burst. Prefer a settled clock while this is true.
   */
  get estimated(): boolean {
    return this.anchor?.estimated ?? false;
  }

  /** Whether the position is known (a title was heard since the last open). */
  get anchored(): boolean {
    return this.anchor != null;
  }

  /**
   * The position as a fixed point — elapsed ms at wall `at`, advancing in
   * real time while `running` — or `null` before a title was heard. The
   * same object until the anchor moves (a title, a pause / resume).
   */
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

  /** A heard title is still waiting for the station to name it (or shown as itself). */
  get awaitingStation(): boolean {
    return this.pending != null;
  }

  /** Whether the heard track has played past its own length. */
  pastEnd(now: number = this.now()): boolean {
    const anchor = this.anchor;
    const track = this.displayed;
    if (!anchor || !track || track.duration <= 0) return false;
    const elapsed = anchor.elapsedMs + (anchor.running ? Math.max(0, now - anchor.at) : 0);
    return elapsed > track.duration;
  }

  /**
   * The stream being played: each one keeps its own calibration, and its
   * bitrate sets where its titles are heard.
   */
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
   * Fresh station data still does not name the heard title (API late, a live
   * show's own title): show the title itself rather than a song that already
   * ended. Replaced by the station's track if it is named later.
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
    if (this.displayed == null) this.onChange();
    const pending = this.pending;
    // A shown fallback title (see `unresolved`) still counts as pending.
    if (!pending) return;
    const track = this.find(pending.title);
    if (track) this.adopt(track, pending.heardAt, pending.tuneIn, pending.lagMs);
  }

  /**
   * Keeps the position on the player's media clock. The anchor advances
   * with the wall clock while audio flows, and a stall or pause stops it
   * when it is *handled* — late when the JS thread is busy, by however long
   * that took. The native media position (a progress reading, with the
   * epoch ms it was taken at) only advances with the audio. The first
   * reading after the position was placed is its reference; from there the
   * position follows the media clock, moved onto it when it is more than
   * {@link MEDIA_ALIGN_MS} off. Returns whether it moved.
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

  /**
   * The source (re)opened: the next title is a tune-in, and until it is heard
   * the position is unknown (the display keeps the current track meanwhile).
   */
  reopened(): void {
    this.anchor = null;
    this.media = null;
    this.pending = null;
  }

  /** HTTP `date` header skew sample (server = device + skew), from the API client. */
  setClockSkew(skewMs: number, rttMs: number): void {
    if (!Number.isFinite(skewMs) || rttMs > SKEW_MAX_RTT_MS) return;
    this.skewSamples = [...this.skewSamples, skewMs].slice(-SKEW_WINDOW);
    const skew = median(this.skewSamples);
    this.skewMs = Math.abs(skew) >= CLOCK_SKEW_APPLY_MS ? skew : 0;
  }

  reset(): void {
    this.displayed = null;
    this.anchor = null;
    this.media = null;
    this.pending = null;
  }

  private calibrate(sample: number): void {
    if (Math.abs(sample) > CALIBRATION_MAX_MS) return;
    const samples = this.calibration.get(this.stream) ?? [];
    this.calibration.set(this.stream, [...samples, sample].slice(-CALIBRATION_WINDOW));
  }

  private find(title: string): Track | null {
    for (const track of this.options.candidates()) {
      if (track?.raw.trim() === title) return track;
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
    // Station time at the moment it was heard, minus the speaker's lag behind
    // the live edge. A tune-in (already partway) can only be placed this way;
    // at a change, where the heard title is the truth, it calibrates that.
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
