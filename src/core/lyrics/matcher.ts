import type { LyricCandidate, TrackFingerprint } from "./types";
import {
  artistVariants,
  containment,
  looksLikeJunk,
  normalizeText,
  similarity,
  tokenOverlap,
} from "./text";

// ─── Candidate validation ───
//
// The lyrics provider answers searches loosely, so its results must be
// validated against every piece of station metadata we have: parsed song
// title, parsed artist, anime name, and the server-stamped duration.
// Title is the gate; duration and artist decide between same-name songs;
// the anime name breaks ties (it often appears in the candidate's album
// or track name, e.g. single releases named after the show). Weights sum
// to 1: a perfect title+artist+duration match lands at 0.90, and the
// anime bonus lifts an already-strong match toward 1.

const WEIGHTS = { title: 0.42, artist: 0.24, duration: 0.24, anime: 0.1 };

/** Below this the candidate is not "that song" no matter what else aligns. */
const TITLE_GATE = 0.45;

/** Overall acceptance threshold for the auto-match. */
export const MATCH_THRESHOLD = 0.6;

const JUNK_PENALTY = 0.75;

/** Duration difference → score (ms). Same song uploads drift a few seconds. */
function durationScore(trackMs: number, candidateSec: number | null): number {
  if (!Number.isFinite(trackMs) || trackMs <= 0) return 0.4;
  if (candidateSec == null || !Number.isFinite(candidateSec) || candidateSec <= 0) {
    return 0.4;
  }
  const deltaMs = Math.abs(trackMs - candidateSec * 1000);
  if (deltaMs <= 2_000) return 1;
  if (deltaMs <= 5_000) return 0.8;
  if (deltaMs <= 10_000) return 0.5;
  if (deltaMs <= 20_000) return 0.25;
  return 0.05;
}

function titleScore(fingerprintTitle: string, candidateName: string): number {
  const trackNorm = normalizeText(fingerprintTitle);
  const candidateNorm = normalizeText(candidateName);
  if (trackNorm.length === 0 || candidateNorm.length === 0) return 0;

  const direct = similarity(trackNorm, candidateNorm);
  const overlap = tokenOverlap(trackNorm, candidateNorm);
  const contains = containment(trackNorm, candidateNorm);

  // Radio titles sometimes carry role suffixes that lyrics databases
  // attach to the artist instead — containment keeps those aligned.
  return Math.max(direct, overlap, contains >= 1 ? 0.92 : 0, contains > 0.6 ? contains * 0.85 : 0);
}

function artistScore(fingerprintArtist: string, candidateArtist: string): number {
  if (!fingerprintArtist.trim()) return 0.5;
  const candidateNorm = normalizeText(candidateArtist);
  if (!candidateNorm) return 0.4;

  let best = 0;
  for (const variant of artistVariants(fingerprintArtist)) {
    best = Math.max(best, similarity(variant, candidateNorm), containment(variant, candidateNorm));
  }
  return best;
}

function animeScore(fingerprintAnime: string, candidate: LyricCandidate): number {
  if (!fingerprintAnime.trim()) return 0;
  const candidateText = normalizeText(`${candidate.trackName} ${candidate.albumName}`);
  const animeNorm = normalizeText(fingerprintAnime);
  return containment(animeNorm, candidateText) > 0.5 ? 1 : 0;
}

/** 0..1 confidence that the candidate is the same recording as the track. */
export function scoreCandidate(
  candidate: LyricCandidate,
  fingerprint: TrackFingerprint,
): number {
  const title = titleScore(fingerprint.title, candidate.trackName);
  if (title < TITLE_GATE) return 0;

  const artist = artistScore(fingerprint.artist, candidate.artistName);
  const duration = durationScore(fingerprint.duration, candidate.durationSec);
  const anime = animeScore(fingerprint.anime, candidate);

  const score =
    WEIGHTS.title * title +
    WEIGHTS.artist * artist +
    WEIGHTS.duration * duration +
    WEIGHTS.anime * anime;

  const junk = looksLikeJunk(candidate.trackName) || looksLikeJunk(candidate.albumName);
  return junk ? score * JUNK_PENALTY : score;
}

export type ScoredCandidate = { candidate: LyricCandidate; score: number };

/** Candidates sorted best-first. Every row keeps its score for diagnostics. */
export function rankCandidates(
  candidates: LyricCandidate[],
  fingerprint: TrackFingerprint,
): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, fingerprint) }))
    .sort((a, b) => b.score - a.score);
}

/** The accepted match, or null when nothing clears the threshold. */
export function pickBest(
  candidates: LyricCandidate[],
  fingerprint: TrackFingerprint,
): ScoredCandidate | null {
  const ranked = rankCandidates(candidates, fingerprint);
  const best = ranked[0];
  if (!best || best.score < MATCH_THRESHOLD) return null;
  if (!best.candidate.syncedLyrics && !best.candidate.plainLyrics && !best.candidate.instrumental) {
    return null;
  }
  return best;
}
