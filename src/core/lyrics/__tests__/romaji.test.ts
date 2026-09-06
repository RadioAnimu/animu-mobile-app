import { afterEach, describe, expect, it } from "vitest";
import { parseLrc } from "../lrc-parser";
import {
  detectLanguage,
  hasKana,
  hiraganaOf,
  pronunciationLabel,
  romajiOf,
} from "../romaji";
import { setJapaneseEngine } from "../../japanese/engine";
import { kuromojiTransliterator } from "../../japanese/dictionary-manager";

afterEach(() => {
  setJapaneseEngine(null);
});

describe("hasKana", () => {
  it("detects hiragana and katakana", () => {
    expect(hasKana("こんにちは")).toBe(true);
    expect(hasKana("アイドル")).toBe(true);
    expect(hasKana("Hello")).toBe(false);
    expect(hasKana("紅蓮華")).toBe(false);
  });
});

describe("romajiOf", () => {
  it("romanizes kana", () => {
    expect(romajiOf("ヒバナ")).toBe("hibana");
    expect(romajiOf("ぐわんぐわんな")).toBe("guwanguwanna");
  });

  it("keeps latin as-is and passes kanji through without the dictionary", () => {
    expect(romajiOf("I feel bloom")).toBe("");
    expect(romajiOf("紅蓮華")).toBe("紅蓮華");
  });

  it("passes kanji through inside a mixed line (kana-only tier)", () => {
    expect(romajiOf("その眼に")).toBe("sono眼ni");
  });

  it("resolves kanji readings once the dictionary engine is installed", () => {
    const fakeTokenizer = {
      tokenize: (text: string) =>
        text.split("").map((char) => ({
          surface_form: char,
          reading: "ゲン",
        })),
    };
    setJapaneseEngine(kuromojiTransliterator(fakeTokenizer));

    expect(romajiOf("眼")).toBe("gen");
    expect(hiraganaOf("眼")).toBe("げん");
  });

  it("hiragana mode folds katakana and hides already-kana lines", () => {
    expect(hiraganaOf("アイドル")).toBe("あいどる");
    expect(pronunciationLabel("hiragana", "ぐわんぐわんな")).toBe("");
    expect(pronunciationLabel("hiragana", "I feel bloom")).toBe("");
    expect(pronunciationLabel("romaji", "ぐわんぐわんな")).toBe(
      "guwanguwanna",
    );
    expect(pronunciationLabel("off", "ぐわんぐわんな")).toBe("");
  });
});

describe("detectLanguage", () => {
  it("reads the dominant script", () => {
    const lines = parseLrc("[00:10.00]こんにちは world\n[00:12.00]アイドル");
    expect(detectLanguage(lines)).toBe("ja");
    expect(detectLanguage(parseLrc("[00:10.00]hello there"))).toBe("latin");
    expect(detectLanguage(parseLrc("[00:10.00]안녕하세요"))).toBe("ko");
    expect(detectLanguage(parseLrc("[00:10.00]привет"))).toBe("ru");
    expect(detectLanguage(parseLrc("[00:10.00]紅蓮華"))).toBe("unknown");
  });
});
