import { describe, expect, it } from "vitest";
import type { JapaneseReader } from "@/core/japanese";
import { detectLanguage } from "@/core/lyrics/language";
import { pronunciationOf } from "@/core/lyrics/pronunciation";

const reader = {
  romaji: (text: string) => `romaji(${text})`,
  hiragana: (text: string) => `hiragana(${text})`,
} as unknown as JapaneseReader;

describe("pronunciationOf", () => {
  it("labels Japanese lines in the chosen mode", () => {
    expect(pronunciationOf("君の名は", "romaji", reader)).toBe("romaji(君の名は)");
    expect(pronunciationOf("君の名は", "hiragana", reader)).toBe("hiragana(君の名は)");
  });

  it("skips what needs no label", () => {
    expect(pronunciationOf("ありがとう", "hiragana", reader)).toBe(""); // already kana
    expect(pronunciationOf("Hello world", "romaji", reader)).toBe("");
    expect(pronunciationOf("君の名は", "off", reader)).toBe("");
    expect(pronunciationOf("君の名は", "romaji", null)).toBe(""); // no dictionary
  });
});

describe("detectLanguage", () => {
  it("tells the script apart", () => {
    expect(detectLanguage(["Hello", "強くなれる理由を知った"])).toBe("ja");
    expect(detectLanguage(["사랑해"])).toBe("ko");
    expect(detectLanguage(["我爱你"])).toBe("zh");
    expect(detectLanguage(["Hello"])).toBe("other");
  });
});
