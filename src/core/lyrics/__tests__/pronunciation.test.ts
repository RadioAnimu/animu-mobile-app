import { describe, expect, it } from "vitest";
import type { JapaneseReader } from "@/core/japanese";
import { detectLanguage } from "@/core/lyrics/language";
import { labelText, lineLabel } from "@/core/lyrics/pronunciation";

/** A dictionary that knows one line. */
const reader = {
  words: () => [
    { text: "この", romaji: "kono", hiragana: "この", spaceAfter: false },
    { text: "痛み", romaji: "itami", hiragana: "いたみ", spaceAfter: false },
    { text: "さえも", romaji: "saemo", hiragana: "さえも", spaceAfter: false },
  ],
} as unknown as JapaneseReader;

const columns = (label: ReturnType<typeof lineLabel>) =>
  label?.kind === "words" ? label.segments.map((segment) => [segment.text, segment.label]) : label;

describe("lineLabel", () => {
  it("prefers the human romaji, split word by word", () => {
    expect(columns(lineLabel("この痛みさえも", "romaji", reader, "kono itami sae mo"))).toEqual([
      ["この", "kono"],
      ["痛み", "itami"],
      ["さえ", "sae"],
      ["も", "mo"],
    ]);
  });

  it("keeps the human romaji as one line when it does not split", () => {
    expect(lineLabel("この痛みさえも", "romaji", reader, "kono itami sae mo zutto")).toEqual({
      kind: "line",
      text: "kono itami sae mo zutto",
    });
  });

  it("falls back to the dictionary, word by word", () => {
    expect(columns(lineLabel("この痛みさえも", "romaji", reader))).toEqual([
      ["この", "kono"],
      ["痛み", "itami"],
      ["さえも", "saemo"],
    ]);
  });

  it("puts hiragana only under words with kanji, from the dictionary only", () => {
    expect(columns(lineLabel("この痛みさえも", "hiragana", reader, "kono itami sae mo"))).toEqual([
      ["この", ""],
      ["痛み", "いたみ"],
      ["さえも", ""],
    ]);
  });

  it("gives nothing when off, for English lines, or without a source", () => {
    expect(lineLabel("この痛みさえも", "off", reader, "kono")).toBeNull();
    expect(lineLabel("Hello world", "romaji", reader, "Hello world")).toBeNull();
    expect(lineLabel("この痛みさえも", "romaji", null)).toBeNull();
    expect(lineLabel("この痛みさえも", "hiragana", null, "kono itami sae mo")).toBeNull();
  });

  it("reads as one string for screen readers", () => {
    expect(labelText(lineLabel("この痛みさえも", "romaji", reader, "kono itami sae mo"))).toBe("kono itami sae mo");
    expect(labelText({ kind: "line", text: "kono" })).toBe("kono");
    expect(labelText(null)).toBe("");
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
