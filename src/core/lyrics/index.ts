/**
 * Lyrics — synced lyrics for the song being heard.
 *
 * - `lyrics-service.ts` — lookups (memory → disk → LRCLIB) and the store;
 * - `matcher.ts` / `text.ts` — validating provider rows against the station's
 *   metadata (title, artist, anime, the cut's duration);
 * - `lrc.ts` — LRC / enhanced LRC → a timeline of lines, words and interludes
 *   on the player's heard-position axis;
 * - `pronunciation.ts` — romaji / hiragana labels for Japanese lines.
 *
 * See docs/ARCHITECTURE.md#lyrics.
 */
export { lyricsService } from "@/core/lyrics/lyrics-factory";
export { LyricsService } from "@/core/lyrics/lyrics-service";
export { lyricsStore, type LyricsSnapshot, type LyricsStatus } from "@/core/lyrics/store";
export { entryIndexAt, entryKey, keyedLines } from "@/core/lyrics/lrc";
export type { Lyrics, LyricEntry, LyricLine, LyricWord, LyricInterlude, LyricsLanguage } from "@/core/lyrics/types";
