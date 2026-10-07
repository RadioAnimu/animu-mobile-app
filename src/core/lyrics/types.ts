/**
 * Lyrics domain types. Times are milliseconds into the song, on the same
 * axis as the player's heard position (`NowHearing.elapsedMs()`).
 */

/** A word (or syllable) with measured timing, from enhanced LRC tags. */
export interface LyricWord {
  text: string;
  startMs: number;
  endMs: number;
  /** A space follows this word when the line is rendered. */
  spaceAfter: boolean;
}

/** A sung line. */
export interface LyricLine {
  kind: "line";
  startMs: number;
  /** Next entry's start, a measured end tag, or an estimate for the last line. */
  endMs: number;
  text: string;
  /**
   * Measured word timing (enhanced LRC), else `null`: the line lights up as a
   * whole. Word times are never estimated — a guessed wipe drifts visibly on
   * held notes and fast verses.
   */
  words: LyricWord[] | null;
}

/** An instrumental stretch (intro or a marked break): breathing dots. */
export interface LyricInterlude {
  kind: "interlude";
  startMs: number;
  endMs: number;
}

export type LyricEntry = LyricLine | LyricInterlude;

/** Script of the lyrics, for the pronunciation toggle. */
export type LyricsLanguage = "ja" | "ko" | "zh" | "other";

/** Where the lyrics came from (shown as credits, kept for diagnostics). */
export interface LyricsSource {
  provider: "lrclib";
  id: number;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
}

export type Lyrics =
  | {
      kind: "synced";
      entries: LyricEntry[];
      /** At least one line carries measured word timing. */
      wordTimed: boolean;
      /**
       * Romaji per entry from a sibling upload (`""` where none), or `null`
       * when LRCLIB has no romaji transcription of these lines.
       */
      romaji: string[] | null;
      language: LyricsLanguage;
      source: LyricsSource;
    }
  | {
      /** Untimed text. */
      kind: "plain";
      lines: string[];
      /** The provider has them synced, but for another cut of the song. */
      otherCut: boolean;
      language: LyricsLanguage;
      source: LyricsSource;
    }
  | { kind: "instrumental"; source: LyricsSource };

/** A provider row before validation against the playing track. */
export interface LyricsCandidate {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  /** Seconds, as the provider reports it; `null` when unknown. */
  durationSec: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/** What the matcher knows about the playing track (station metadata). */
export interface TrackQuery {
  title: string;
  artist: string;
  anime: string;
  /** Milliseconds; `0` when unknown. */
  durationMs: number;
}
