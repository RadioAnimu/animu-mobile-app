import { describe, expect, it } from "vitest";
import { SYNC_TOLERANCE_MS, isTimedFor, pickBest, scoreCandidate } from "@/core/lyrics/matcher";
import { artistNames, bestSimilarity, normalize, titleVariants, type Romanizer } from "@/core/lyrics/text";
import type { LyricsCandidate, TrackQuery } from "@/core/lyrics/types";

let nextId = 1;
const row = (overrides: Partial<LyricsCandidate>): LyricsCandidate => ({
  id: nextId++,
  trackName: "",
  artistName: "",
  albumName: "",
  durationSec: null,
  instrumental: false,
  plainLyrics: "la la",
  syncedLyrics: "[00:01.00]la la",
  ...overrides,
});

const track = (overrides: Partial<TrackQuery>): TrackQuery => ({
  title: "",
  artist: "",
  anime: "",
  durationMs: 0,
  ...overrides,
});

// Rows as LRCLIB returned them for station tracks (2026-10-06).
describe("scoreCandidate", () => {
  it("accepts the same song written differently", () => {
    const gurenge = track({ title: "Gurenge", artist: "LiSA", durationMs: 235_000 });
    expect(scoreCandidate(gurenge, row({ trackName: "Gurenge", artistName: "Lisa", durationSec: 236 })).identity).toBeGreaterThan(0.9);
    const cherry = track({ title: "Sweet & Sweet CHERRY", artist: "Yui Horie" });
    expect(scoreCandidate(cherry, row({ trackName: "Sweet & Sweet Cherry", artistName: "Horie Yui" })).identity).toBeGreaterThan(0.9);
  });

  it("finds the title inside brackets, ` - ` splits and `feat.` tails", () => {
    const life = track({ title: "LIFE", artist: "Rude-α" });
    expect(scoreCandidate(life, row({ trackName: "Rude-α 『LIFE』", artistName: "Rude-α" })).identity).toBeGreaterThan(0.9);
    const zankyo = track({ title: "Zankyosanka", artist: "Aimer" });
    expect(scoreCandidate(zankyo, row({ trackName: "残響散歌 - Zankyosanka", artistName: "Aimer" })).identity).toBeGreaterThan(0.9);
    const milk = track({ title: "MILK TEA", artist: "Akari Dritschler" });
    const scored = scoreCandidate(
      milk,
      row({ trackName: "MILK TEA feat. Akari Dritschler", artistName: "Yuji Ohno & Lupintic Six, Akari Dritschler" }),
    );
    expect(scored.identity).toBeGreaterThan(0.9);
  });

  it("credits the voice actor behind a character song", () => {
    expect(artistNames("Hachiman Hikigaya (CV: Takuya Eguchi) with Saika Totsuka (CV: Mikako Komatsu)")).toEqual(
      expect.arrayContaining(["hachiman hikigaya", "takuya eguchi", "mikako komatsu"]),
    );
  });

  it("matches a co-credit where the station names one artist", () => {
    const answer = track({ title: "THE ANSWER", artist: "Laco" });
    expect(scoreCandidate(answer, row({ trackName: "THE ANSWER", artistName: "Hiroyuki Sawano, Laco" })).identity).toBeGreaterThan(0.9);
  });

  it("rejects another song", () => {
    const kick = track({ title: "KICK BACK", artist: "Kenshi Yonezu" });
    expect(scoreCandidate(kick, row({ trackName: "Lemon", artistName: "Kenshi Yonezu" })).identity).toBe(0);
    expect(scoreCandidate(kick, row({ trackName: "KICK BACK", artistName: "Some Cover Band" })).identity).toBe(0);
  });

  it("rejects instrumental rows and other-language versions", () => {
    const fly = track({ title: "fly with the night", artist: "Morfonica" });
    expect(
      scoreCandidate(fly, row({ trackName: "fly with the night -instrumental-", artistName: "Morfonica" })).identity,
    ).toBe(0);
    const riseUp = track({ title: "RISE UP -English Ver.-", artist: "NiziU" });
    expect(scoreCandidate(riseUp, row({ trackName: "RISE UP", artistName: "NiziU" })).identity).toBe(0);
    expect(scoreCandidate(riseUp, row({ trackName: "RISE UP (English Ver.)", artistName: "NiziU" })).identity).toBeGreaterThan(0.9);
    const idol = track({ title: "Idol", artist: "YOASOBI" });
    expect(scoreCandidate(idol, row({ trackName: "Idol (English Version)", artistName: "YOASOBI" })).identity).toBe(0);
  });

  it("times a row for the cut on air only within the tolerance", () => {
    const kick = track({ title: "KICK BACK", artist: "Kenshi Yonezu", durationMs: 194_000 });
    const full = scoreCandidate(kick, row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 193 }));
    const tvSize = scoreCandidate(kick, row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 87 }));
    expect(full.durationFits).toBe(true);
    expect(tvSize.durationFits).toBe(false);
    expect(tvSize.identity).toBeGreaterThan(0);
    expect(SYNC_TOLERANCE_MS).toBeLessThan(10_000);
  });

  it("compares kanji titles once a reader romanizes them", () => {
    const readings: Record<string, string> = { 新時代: "shin jidai", 祝福: "shukufuku" };
    const reader: Romanizer = (text) => text.replace(/[新時代祝福]+/g, (kanji) => readings[kanji] ?? kanji);
    const shin = track({ title: "Shin Jidai", artist: "Ado" });
    const candidate = row({ trackName: "新時代", artistName: "Ado" });
    expect(scoreCandidate(shin, candidate).identity).toBe(0);
    expect(scoreCandidate(shin, candidate, reader).identity).toBeGreaterThan(0.9);
  });
});

describe("pickBest", () => {
  const kick = track({ title: "KICK BACK", artist: "Kenshi Yonezu", durationMs: 194_000 });

  it("prefers lyrics timed for this cut over untimed ones", () => {
    const plainOnly = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 194, syncedLyrics: null });
    const otherCut = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 278 });
    const timed = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 195 });
    const best = pickBest(kick, [plainOnly, otherCut, timed]);
    expect(best?.candidate).toBe(timed);
    expect(best && isTimedFor(best)).toBe(true);
  });

  it("prefers word timing, then the closer duration", () => {
    const lines = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 194 });
    const words = row({
      trackName: "KICK BACK",
      artistName: "Kenshi Yonezu",
      durationSec: 196,
      syncedLyrics: "[00:01.00]<00:01.00>a <00:01.50>b",
    });
    expect(pickBest(kick, [lines, words])?.candidate).toBe(words);
    const near = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 194.2 });
    const far = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 197 });
    expect(pickBest(kick, [far, near])?.candidate).toBe(near);
  });

  it("falls back to another cut's lyrics, untimed", () => {
    const otherCut = row({ trackName: "KICK BACK", artistName: "Kenshi Yonezu", durationSec: 87 });
    const best = pickBest(kick, [otherCut]);
    expect(best?.candidate).toBe(otherCut);
    expect(best && isTimedFor(best)).toBe(false);
  });

  it("returns an instrumental match only for this cut, and null for strangers", () => {
    const inst = row({
      trackName: "KICK BACK",
      artistName: "Kenshi Yonezu",
      durationSec: 194,
      instrumental: true,
      plainLyrics: null,
      syncedLyrics: null,
    });
    expect(pickBest(kick, [inst])?.candidate).toBe(inst);
    expect(pickBest(kick, [{ ...inst, durationSec: 90 }])).toBeNull();
    expect(pickBest(kick, [row({ trackName: "Lemon", artistName: "Kenshi Yonezu" })])).toBeNull();
  });
});

describe("text", () => {
  it("normalizes width, case, kana and punctuation", () => {
    expect(normalize("ＫＩＣＫ　ＢＡＣＫ！")).toBe("kick back");
    expect(normalize("ヒバナ")).toBe("hibana");
  });

  it("lists title variants", () => {
    expect(titleVariants("Yume wo Idaite ~Hajimari no Crissroad~")).toEqual(
      expect.arrayContaining(["yume wo idaite", "hajimari no crissroad"]),
    );
    expect(titleVariants("Sanctuary (Opening)")).toEqual(["sanctuary opening", "sanctuary"]);
    expect(titleVariants("Gurenge (TV Size)")).toEqual(["gurenge tv size", "gurenge"]);
  });

  it("matches name order and spacing", () => {
    expect(bestSimilarity(["utada hikaru"], ["hikaru utada"])).toBe(1);
    expect(bestSimilarity(["shin jidai"], ["shinjidai"])).toBe(1);
  });
});
