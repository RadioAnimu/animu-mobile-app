import type { JapaneseReader } from "@/core/japanese";

export type PronunciationMode = "off" | "romaji" | "hiragana";

const JAPANESE = /[ぁ-ヿ㐀-䶿一-鿿]/;
const KANJI = /[㐀-䶿一-鿿]/;

/**
 * The label under a lyric line: its romaji, or its hiragana when it has
 * kanji to read (a kana line already reads as written). Lines without
 * Japanese (English hooks) get none.
 */
export function pronunciationOf(text: string, mode: PronunciationMode, reader: JapaneseReader | null): string {
  if (mode === "off" || !reader || !JAPANESE.test(text)) return "";
  if (mode === "hiragana") return KANJI.test(text) ? reader.hiragana(text) : "";
  return reader.romaji(text);
}
