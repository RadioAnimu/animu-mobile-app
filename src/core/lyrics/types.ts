import type { Track } from "../domain/track";

/** A single karaoke word with its absolute start time (ms). */
export type LyricWord = {
  text: string;
  /** Absolute song-time in ms — may be measured (enhanced LRC) or estimated. */
  startMs: number;
};

/** One lyric line, optionally word-timed for karaoke highlighting. */
export type LyricLine = {
  /** Absolute song-time in ms. */
  timeMs: number;
  text: string;
  /**
   * Word-level times when available. Always present after karaoke
   * preparation: measured from enhanced-LRC tags or estimated from
   * the line duration.
   */
  words: LyricWord[];
  /** True when word times came from real `<mm:ss.xx>` tags. */
  wordTimed: boolean;
};

export type LyricsLanguage =
  | "ja"
  | "ko"
  | "ru"
  | "latin"
  | "mixed"
  | "unknown";

export type LyricsStatus =
  | "idle"
  | "loading"
  | "found"
  | "plain"
  | "instrumental"
  | "not-found"
  | "error";

export type MatchedMeta = {
  title: string;
  artist: string;
  album: string;
  duration: number | null;
};

export type LyricsSnapshot = {
  status: LyricsStatus;
  /** Lyrics of this track key — consumers guard against stale emits. */
  trackKey: string | null;
  lines: LyricLine[];
  /** Plain (untimed) text — shown as a static list without karaoke. */
  plainText: string | null;
  language: LyricsLanguage;
  matched: MatchedMeta | null;
  /** True when at least one line has measured word tags. */
  hasMeasuredWords: boolean;
  updatedAt: number;
};

export type CachedLyrics = Pick<
  LyricsSnapshot,
  "lines" | "plainText" | "language" | "matched" | "hasMeasuredWords"
> & { kind: "synced" | "plain" | "instrumental" };

export type LyricsFetchOutcome =
  | { kind: "found"; lyrics: CachedLyrics; score: number }
  | { kind: "instrumental"; candidate: LyricCandidate; score: number }
  | { kind: "not-found" };

/** Search result row from the lyrics provider, before scoring. */
export type LyricCandidate = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  /** Seconds (float) as reported by the provider; null when unknown. */
  durationSec: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

/** Everything the matcher needs to validate a candidate against the playing track. */
export type TrackFingerprint = Pick<
  Track,
  "title" | "artist" | "anime" | "raw" | "duration"
>;
