import { describe, expect, it } from "vitest";
import { buildTimeline, parseLrc } from "@/core/lyrics/lrc";
import { scoreCandidate } from "@/core/lyrics/matcher";
import { findRomajiSibling, pairRomaji } from "@/core/lyrics/romaji-pair";
import type { LyricsCandidate } from "@/core/lyrics/types";

// Minami - Kawaki wo Ameku, as uploaded to LRCLIB twice (2026-10-07).
const japanese = `[00:21.94]No destiny ふさわしく無い
[00:25.52]こんなんじゃきっと物足りない
[00:28.70]くらい語っとけば上手くいく
[00:31.98]物、金、愛、言、もう自己顕示見飽きた
[00:36.00]`;
const romaji = `[00:22.06]No destiny fusawashiku nai
[00:25.76]Konnan ja kitto monotarinai
[00:28.83]Kurai katattokeba umaku iku
[00:32.10]Mono, kane, ai, koto, mou jiko kenji akita`;
const spanish = `[00:22.06]Ningún destino me queda bien
[00:25.76]Así seguro que no es suficiente
[00:28.83]Si hablo de lo oscuro todo irá bien
[00:32.10]Cosas, dinero, amor, palabras, ya me cansé`;

const entries = buildTimeline(parseLrc(japanese));

describe("pairRomaji", () => {
  it("labels each Japanese line with the romaji line sung with it", () => {
    const labels = pairRomaji(entries, romaji)!;
    const lines = entries.flatMap((entry, index) => (entry.kind === "line" ? [[entry.text, labels[index]]] : []));
    expect(lines[1]).toEqual(["こんなんじゃきっと物足りない", "Konnan ja kitto monotarinai"]);
    expect(lines[3][1]).toBe("Mono, kane, ai, koto, mou jiko kenji akita");
    expect(labels).toHaveLength(entries.length);
  });

  it("gives one Japanese line every romaji line sung within it, and no more", () => {
    const joined = buildTimeline(parseLrc("[00:10.00]強くなれる理由を知った 僕を連れて進め\n[00:20.00]泥だらけの走馬灯に酔う"));
    const split = `[00:10.10]Tsuyoku nareru riyuu wo shitta
[00:14.50]Boku wo tsurete susume
[00:20.05]Dorodarake no soumatou ni you`;
    expect(pairRomaji(joined, split)).toEqual([
      "", // the intro
      "Tsuyoku nareru riyuu wo shitta Boku wo tsurete susume",
      "Dorodarake no soumatou ni you",
    ]);
  });

  it("rejects a translation and lines that do not line up", () => {
    expect(pairRomaji(entries, spanish)).toBeNull();
    const shifted = romaji.replace(/\[00:(\d\d)/g, (_, s) => `[01:${s}`);
    expect(pairRomaji(entries, shifted)).toBeNull();
    expect(pairRomaji(entries, "")).toBeNull();
  });

  it("rejects another Japanese upload", () => {
    expect(pairRomaji(entries, japanese)).toBeNull();
  });
});

describe("findRomajiSibling", () => {
  const row = (id: number, syncedLyrics: string, durationSec = 252): LyricsCandidate => ({
    id,
    trackName: "Kawaki wo Ameku",
    artistName: "Minami",
    albumName: "",
    durationSec,
    instrumental: false,
    plainLyrics: null,
    syncedLyrics,
  });
  const track = { title: "Kawaki wo Ameku", artist: "Minami", anime: "Domestic na Kanojo", durationMs: 251_900 };
  const original = scoreCandidate(track, row(1, japanese));

  it("finds the romaji upload of the same cut", () => {
    const rows = [row(1, japanese), row(2, spanish), row(3, romaji, 251), row(4, romaji, 113)];
    expect(findRomajiSibling(track, original, rows)?.id).toBe(3);
  });

  it("finds none without a matching cut", () => {
    expect(findRomajiSibling(track, original, [row(4, romaji, 113)])).toBeNull();
    expect(findRomajiSibling(track, original, [row(1, japanese)])).toBeNull();
  });
});
