import { describe, expect, it } from "vitest";
import { alignRomaji, timeSegments } from "@/core/lyrics/segments";

const pieces = (text: string, romaji: string) =>
  alignRomaji(text, romaji)?.map(({ text: piece, label }) => [piece, label]) ?? null;

describe("alignRomaji", () => {
  it("sets each romaji word under its Japanese word", () => {
    expect(pieces("この痛みさえも", "kono itami sae mo")).toEqual([
      ["この", "kono"],
      ["痛み", "itami"],
      ["さえ", "sae"],
      ["も", "mo"],
    ]);
  });

  it("reads kanji runs with their okurigana", () => {
    expect(pieces("くらい語っとけば上手くいく", "Kurai katattokeba umaku iku")).toEqual([
      ["くらい", "Kurai"],
      ["語っとけば", "katattokeba"],
      ["上手く", "umaku"],
      ["いく", "iku"],
    ]);
    expect(pieces("こんなんじゃきっと物足りない", "Konnan ja kitto monotarinai")?.map(([piece]) => piece)).toEqual([
      "こんなん",
      "じゃ",
      "きっと",
      "物足りない",
    ]);
  });

  it("knows particles are said differently, katakana and long vowels", () => {
    expect(pieces("君の名は", "kimi no na wa")?.at(-1)).toEqual(["は", "wa"]);
    expect(pieces("夢を見た", "yume o mita")?.[1]).toEqual(["を", "o"]);
    expect(pieces("ヒカリとなって", "hikari to natte")?.[0]).toEqual(["ヒカリ", "hikari"]);
    expect(pieces("スーパースター", "suupaasutaa")).toEqual([["スーパースター", "suupaasutaa"]]);
  });

  it("keeps English and punctuation, and spaces of the Japanese line", () => {
    const segments = alignRomaji("No destiny ふさわしく無い", "No destiny fusawashiku nai")!;
    expect(segments.map(({ text, label }) => [text, label])).toEqual([
      ["No", "No"],
      ["destiny", "destiny"],
      ["ふさわしく", "fusawashiku"],
      ["無い", "nai"],
    ]);
    expect(segments.map((segment) => segment.spaceAfter)).toEqual([true, true, false, false]);
    expect(pieces("物、金、愛", "Mono, kane, ai")).toEqual([
      ["物、", "Mono"],
      ["金、", "kane"],
      ["愛", "ai"],
    ]);
  });

  it("reads macrons, full-width digits and English contractions", () => {
    expect(pieces("もう迷わない", "Mō mayowanai")?.[0]).toEqual(["もう", "Mō"]);
    expect(pieces("また１から", "mata 1 kara")?.[1]).toEqual(["１", "1"]);
    expect(pieces("夜の匂いに (I'll spend)", "Yoru no nioi ni (I'll spend)")?.slice(-2)).toEqual([
      ["(I'll", "I'll"],
      ["spend)", "spend"],
    ]);
  });

  it("gives up on a long near-miss quickly (no exponential backtracking)", () => {
    const text = "愛".repeat(40) + "あ";
    const started = Date.now();
    expect(alignRomaji(text, `${"ai ".repeat(30)}i`)).toBeNull();
    // Exponential backtracking would take minutes here; a loose bound keeps
    // the test steady under coverage instrumentation.
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("gives up when the lines do not match", () => {
    expect(alignRomaji("この痛みさえも", "Even this pain")).toBeNull();
    expect(alignRomaji("この痛みさえも", "kono itami")).toBeNull();
    expect(alignRomaji("この痛みさえも", "")).toBeNull();
  });
});

describe("timeSegments", () => {
  const words = [
    { text: "この", startMs: 1_000, endMs: 1_400, spaceAfter: false },
    { text: "痛", startMs: 1_400, endMs: 1_700, spaceAfter: false },
    { text: "み", startMs: 1_700, endMs: 2_000, spaceAfter: false },
    { text: "さえ", startMs: 2_000, endMs: 2_500, spaceAfter: false },
    { text: "も", startMs: 2_500, endMs: 3_000, spaceAfter: false },
  ];

  it("spans each segment over the timed words it covers", () => {
    const segments = alignRomaji("この痛みさえも", "kono itami sae mo")!;
    expect(timeSegments(segments, words)?.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [1_000, 1_400],
      [1_400, 2_000],
      [2_000, 2_500],
      [2_500, 3_000],
    ]);
  });

  it("is null when the texts disagree", () => {
    expect(timeSegments([{ text: "全然違う", label: "", spaceAfter: false }], words)).toBeNull();
  });
});
