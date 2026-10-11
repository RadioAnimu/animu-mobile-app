import type { LyricsLanguage } from "@/core/lyrics/types";

const KANA = /[ぁ-ヿ]/;
const HANGUL = /[ᄀ-ᇿ가-힯]/;
const HAN = /[㐀-䶿一-鿿]/;

/**
 * The song's script, from its lines. Kana means Japanese even among English
 * hooks and kanji; Han without kana is Chinese.
 */
export function detectLanguage(lines: readonly string[]): LyricsLanguage {
  let han = false;
  let hangul = false;
  for (const line of lines) {
    if (KANA.test(line)) return "ja";
    hangul ||= HANGUL.test(line);
    han ||= HAN.test(line);
  }
  if (hangul) return "ko";
  return han ? "zh" : "other";
}
