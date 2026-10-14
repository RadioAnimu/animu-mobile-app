import { describe, expect, it } from "vitest";
import { toHiragana, toKana, toRomaji } from "wanakana";

describe("bounded Japanese conversion", () => {
  it("handles long external titles and kana without recursive stack exhaustion", () => {
    const literal = `Song ${"(".repeat(50_000)}`;
    expect(toRomaji(literal)).toBe(literal);
    expect(toRomaji("かな".repeat(25_000))).toBe("kana".repeat(25_000));
    expect(toHiragana("kana".repeat(10_000))).toBe("かな".repeat(10_000));
  });

  it.each([
    ["きゃっこう。", "kyakkou."],
    ["カタカナ 「abc」", "katakana ‘abc’"],
    ["んあ", "n'a"],
    ["ヴァイオリン", "vuaiorin"],
    ["", ""],
  ])("preserves readings and punctuation for %s", (input, expected) => {
    expect(toRomaji(input)).toBe(expected);
  });

  it("preserves unfinished input, custom mappings, and small kana", () => {
    expect(toKana("kan", { IMEMode: true })).toBe("かn");
    expect(toKana("kya")).toBe("きゃ");
    expect(toRomaji("ちゃ", { customRomajiMapping: { ちゃ: "cha-custom" } })).toBe("cha-custom");
  });
});
