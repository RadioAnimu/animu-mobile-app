import { describe, expect, it } from "vitest";
import { MATCH_THRESHOLD, pickBest, rankCandidates, scoreCandidate } from "../matcher";
import type { LyricCandidate, TrackFingerprint } from "../types";

const fingerprint: TrackFingerprint = {
  title: "アイドル",
  artist: "YOASOBI",
  anime: "推しの子",
  raw: "YOASOBI - アイドル | 推しの子",
  duration: 212_000,
};

const candidate = (overrides: Partial<LyricCandidate>): LyricCandidate => ({
  id: 1,
  trackName: "アイドル",
  artistName: "YOASOBI",
  albumName: "THE BOOK 3",
  durationSec: 212,
  instrumental: false,
  plainLyrics: null,
  syncedLyrics: "[00:10.00]line",
  ...overrides,
});

describe("scoreCandidate", () => {
  it("scores a true match at the ceiling (0.90 without the anime bonus)", () => {
    const score = scoreCandidate(candidate({}), fingerprint);
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThanOrEqual(0.9);
  });

  it("matches romaji-titled candidates against kana station titles", () => {
    const score = scoreCandidate(
      candidate({ trackName: "Idol", albumName: "Oshi no Ko" }),
      { ...fingerprint, title: "アイドル" },
    );
    expect(score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it("rejects a same-title song by the wrong artist and duration", () => {
    const score = scoreCandidate(
      candidate({ artistName: "Mrs. GREEN APPLE", durationSec: 300 }),
      fingerprint,
    );
    expect(score).toBeLessThan(MATCH_THRESHOLD);
  });

  it("rejects candidates whose title is unrelated", () => {
    const score = scoreCandidate(
      candidate({ trackName: "Blueming", artistName: "IU" }),
      fingerprint,
    );
    expect(score).toBe(0);
  });

  it("penalizes duration drift without fully blocking a loose upload", () => {
    const tight = scoreCandidate(candidate({}), fingerprint);
    const drifted = scoreCandidate(
      candidate({ durationSec: 219 }),
      fingerprint,
    );
    expect(drifted).toBeLessThan(tight);
    expect(drifted).toBeGreaterThan(0.6);
  });

  it("awards the anime-name bonus appearing in album or track names", () => {
    const withAnime = scoreCandidate(
      candidate({ albumName: "推しの子 EP" }),
      fingerprint,
    );
    const withoutAnime = scoreCandidate(candidate({}), fingerprint);
    expect(withAnime).toBeGreaterThan(withoutAnime);
  });

  it("downgrades junk uploads (nightcore, official videos)", () => {
    const clean = scoreCandidate(candidate({}), fingerprint);
    const junk = scoreCandidate(
      candidate({ trackName: "アイドル nightcore" }),
      fingerprint,
    );
    expect(junk).toBeLessThan(clean);
  });

  it("treats unknown durations on either side as neutral", () => {
    const score = scoreCandidate(candidate({ durationSec: null }), fingerprint);
    expect(score).toBeGreaterThan(MATCH_THRESHOLD);
  });
});

describe("pickBest", () => {
  it("returns the highest-ranked candidate above the threshold", () => {
    const best = pickBest(
      [
        candidate({ id: 10, durationSec: 300 }),
        candidate({ id: 11 }),
        candidate({ id: 12, artistName: "Other Artist", durationSec: 288 }),
      ],
      fingerprint,
    );
    expect(best?.candidate.id).toBe(11);
    expect(best?.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it("returns null when nothing fits", () => {
    expect(
      pickBest(
        [candidate({ artistName: "Nope", trackName: "Nope", durationSec: 300 })],
        fingerprint,
      ),
    ).toBeNull();
    expect(pickBest([], fingerprint)).toBeNull();
  });

  it("returns null for rows with no lyric bodies at all", () => {
    const best = pickBest(
      [candidate({ syncedLyrics: null, plainLyrics: null })],
      fingerprint,
    );
    expect(best).toBeNull();
  });
});

describe("rankCandidates", () => {
  it("sorts best-first", () => {
    const ranked = rankCandidates(
      [
        candidate({ id: 1, durationSec: 288 }),
        candidate({ id: 2 }),
      ],
      fingerprint,
    );
    expect(ranked[0].candidate.id).toBe(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });
});
