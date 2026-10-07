import type { LyricsCandidate, TrackQuery } from "@/core/lyrics/types";
import {
  artistNames,
  bestSimilarity,
  kanaRomanizer,
  normalize,
  titleVariants,
  type Romanizer,
} from "@/core/lyrics/text";

// ─── Candidate validation ───
//
// The provider answers loosely, so every row is checked against the station's
// metadata. Identity (title + artist) decides whether a row is this song;
// duration decides whether its timing fits the cut on air: anime songs exist
// as TV size (~90 s), full and live cuts, and synced lyrics of another cut
// would be wrong from the first line. Such a row still provides the words,
// shown untimed.

/** Below this the row is another song, whatever else lines up. */
const TITLE_MIN = 0.78;
/** Identity (title 60% + artist 40%) a row needs to be accepted. */
const IDENTITY_MIN = 0.74;
/** Synced lyrics are timed for the cut on air within this (ms). */
export const SYNC_TOLERANCE_MS = 4_000;
/** A name we cannot compare (kanji without a reader) neither helps nor hurts. */
const UNKNOWN_ARTIST_SCORE = 0.6;

type Version = "instrumental" | "english" | "korean" | "chinese" | "live" | "remix" | "acoustic";

const VERSION_PATTERNS: Record<Version, RegExp> = {
  instrumental: /\b(?:instrumental|inst|off ?vocal|karaoke|backing track)\b|カラオケ|オフボーカル/,
  english: /\b(?:english|eng) ?(?:ver(?:sion)?|lyrics)?\b/,
  korean: /\bkorean ?(?:ver(?:sion)?)?\b/,
  chinese: /\b(?:chinese|mandarin) ?(?:ver(?:sion)?)?\b/,
  live: /\blive\b|ライブ/,
  remix: /\bremix\b/,
  acoustic: /\bacoustic\b/,
};

function versions(text: string): Set<Version> {
  const lower = text.normalize("NFKC").toLowerCase();
  const found = new Set<Version>();
  for (const [version, pattern] of Object.entries(VERSION_PATTERNS) as [Version, RegExp][]) {
    if (pattern.test(lower)) found.add(version);
  }
  return found;
}

/**
 * 1 when both name the same version of the song. A version only one side
 * names (an instrumental, a language, a live take) is another recording:
 * instrumental rows carry no words, the others carry different ones.
 */
function versionFactor(track: TrackQuery, candidate: LyricsCandidate): number {
  const wanted = versions(track.title);
  const offered = versions(`${candidate.trackName} ${candidate.albumName}`);
  if (offered.has("instrumental") && !wanted.has("instrumental")) return 0;
  let factor = 1;
  for (const version of offered) if (!wanted.has(version)) factor *= 0.55;
  for (const version of wanted) if (!offered.has(version)) factor *= 0.7;
  return factor;
}

export interface ScoredCandidate {
  candidate: LyricsCandidate;
  /** 0..1 confidence that the row is the playing song. */
  identity: number;
  /** Timing fits the cut on air (or the cut's length is unknown). */
  durationFits: boolean;
  /** |track − row| in ms; `Infinity` when either is unknown. */
  durationDeltaMs: number;
}

function artistScore(track: TrackQuery, candidate: LyricsCandidate, romanize: Romanizer): number {
  const wanted = artistNames(track.artist, romanize);
  const offered = artistNames(candidate.artistName, romanize);
  if (!wanted.length || !offered.length) return UNKNOWN_ARTIST_SCORE;
  const score = bestSimilarity(wanted, offered);
  // A credit still in kanji could not be romanized: no evidence either way.
  const unreadable = offered.every((name) => !/[a-z0-9]/.test(name));
  return unreadable ? Math.max(score, UNKNOWN_ARTIST_SCORE) : score;
}

/** Scores one row against the playing track (`identity` 0 = rejected). */
export function scoreCandidate(
  track: TrackQuery,
  candidate: LyricsCandidate,
  romanize: Romanizer = kanaRomanizer,
): ScoredCandidate {
  const delta =
    track.durationMs > 0 && candidate.durationSec != null && candidate.durationSec > 0
      ? Math.abs(track.durationMs - candidate.durationSec * 1000)
      : Number.POSITIVE_INFINITY;
  const durationFits = track.durationMs <= 0 || candidate.durationSec == null || delta <= SYNC_TOLERANCE_MS;
  const scored = { candidate, identity: 0, durationFits, durationDeltaMs: delta };

  const title = bestSimilarity(
    titleVariants(track.title, romanize),
    titleVariants(candidate.trackName, romanize),
  );
  if (title < TITLE_MIN) return scored;

  let identity = 0.6 * title + 0.4 * artistScore(track, candidate, romanize);
  // The anime's name in the album/title (single releases are named after it).
  const anime = normalize(track.anime, romanize);
  if (anime.length > 3 && normalize(`${candidate.albumName} ${candidate.trackName}`, romanize).includes(anime)) {
    identity = Math.min(1, identity + 0.05);
  }
  identity *= versionFactor(track, candidate);
  return { ...scored, identity: identity >= IDENTITY_MIN ? identity : 0 };
}

/** What a row offers, best first: timed words, timed lines, untimed text. */
function usefulness(scored: ScoredCandidate): number {
  const { candidate, durationFits } = scored;
  if (candidate.syncedLyrics && durationFits) {
    return candidate.syncedLyrics.includes("<") ? 4 : 3;
  }
  if (candidate.syncedLyrics || candidate.plainLyrics) return 2;
  return candidate.instrumental && durationFits ? 1 : 0;
}

/**
 * The best accepted row, or `null`. Lyrics timed for the cut on air win over
 * untimed ones; among equals, the surer identity and then the closer
 * duration.
 */
export function pickBest(
  track: TrackQuery,
  candidates: readonly LyricsCandidate[],
  romanize: Romanizer = kanaRomanizer,
): ScoredCandidate | null {
  let best: ScoredCandidate | null = null;
  let bestRank = 0;
  for (const candidate of candidates) {
    const scored = scoreCandidate(track, candidate, romanize);
    const useful = usefulness(scored);
    if (scored.identity === 0 || useful === 0) continue;
    // Identity separates rows by more than a rounding error only.
    const rank = useful * 10 + Math.round(scored.identity * 20) / 20;
    const better =
      rank > bestRank ||
      (rank === bestRank && best != null && scored.durationDeltaMs < best.durationDeltaMs);
    if (better) {
      best = scored;
      bestRank = rank;
    }
  }
  return best;
}

/** Whether a row (as picked) carries synced lyrics usable for this cut. */
export function isTimedFor(scored: ScoredCandidate): boolean {
  return Boolean(scored.candidate.syncedLyrics) && scored.durationFits;
}
