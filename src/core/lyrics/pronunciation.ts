import type { JapaneseReader } from "@/core/japanese";
import { alignRomaji, type LabelSegment } from "@/core/lyrics/segments";

export type PronunciationMode = "off" | "romaji" | "hiragana";

/**
 * The reading under a lyric line: word by word (each word's reading under
 * the word, Apple Music style), or as one line when a human romaji line
 * cannot be split onto the Japanese one.
 */
export type LineLabel = { kind: "words"; segments: LabelSegment[] } | { kind: "line"; text: string };

const JAPANESE = /[ぁ-ヿ㐀-䶿一-鿿]/;
const KANJI = /[㐀-䶿一-鿿]/;

/**
 * A line's reading, from the best source there is:
 * 1. romaji: the human romaji upload, split word by word — or kept as one
 *    line when it does not split;
 * 2. the dictionary, word by word: romaji under every Japanese word,
 *    hiragana under the words with kanji (kana already reads as written);
 * 3. nothing (English lines, no source).
 */
export function lineLabel(
  text: string,
  mode: PronunciationMode,
  reader: JapaneseReader | null,
  paired = "",
): LineLabel | null {
  if (mode === "off" || !JAPANESE.test(text)) return null;
  if (mode === "romaji" && paired) {
    const segments = alignRomaji(text, paired);
    return segments ? { kind: "words", segments } : { kind: "line", text: paired };
  }
  if (!reader) return null;
  const segments = reader.words(text).map((word) => ({
    text: word.text,
    label: readingOf(word, mode),
    spaceAfter: word.spaceAfter,
  }));
  return segments.some((segment) => segment.label) ? { kind: "words", segments } : null;
}

function readingOf(word: { text: string; romaji: string; hiragana: string }, mode: PronunciationMode): string {
  if (mode === "hiragana") return KANJI.test(word.text) ? word.hiragana : "";
  return JAPANESE.test(word.text) ? word.romaji : "";
}

/** The reading as one string (screen readers, plain text). */
export function labelText(label: LineLabel | null): string {
  if (!label) return "";
  if (label.kind === "line") return label.text;
  return label.segments
    .map((segment) => segment.label)
    .filter(Boolean)
    .join(" ");
}
