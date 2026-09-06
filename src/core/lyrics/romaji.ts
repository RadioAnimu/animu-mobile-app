import {
  getJapaneseEngine,
  getJapaneseEngineVersion,
  katakanaToHiragana,
} from "../japanese/engine";
import { toRomaji } from "wanakana";
import type { LyricsLanguage, LyricLine } from "./types";

// ─── Romaji & furigana ───
//
// Japanese lines get a pronunciation label under the karaoke text. Two
// render modes:
// - romaji: kana always; kanji too once the offline dictionary's
//   tokenizer is installed;
// - hiragana: the full line's reading (katakana → hiragana included) —
//   aimed at Japanese learners.
// Lines already in Latin script (English hooks inside a J-pop song, or
// western songs entirely) skip the label in both modes.

const KANA_RANGE = /[\u3041-\u30ff]/;
const KANJI_RANGE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const HANGUL_RANGE = /[\uac00-\ud7af]/;
const CYRILLIC_RANGE = /[\u0400-\u04ff]/;
const LATIN_RANGE = /[A-Za-z]/;

export function hasKana(text: string): boolean {
  return KANA_RANGE.test(text ?? "");
}

export function hasKanji(text: string): boolean {
  return KANJI_RANGE.test(text ?? "");
}

export function hasJapanese(text: string): boolean {
  return hasKana(text) || hasKanji(text);
}

/** Kana-only rendering — the always-available fallback tier. */
function kanaOnlyHiragana(text: string): string {
  return katakanaToHiragana(text);
}

const labelCache = new Map<string, string>();
let cacheVersion = getJapaneseEngineVersion();

function labelCacheForCurrentEngine(): Map<string, string> {
  const version = getJapaneseEngineVersion();
  if (version !== cacheVersion) {
    // Engine installed/removed — stale readings must not survive.
    labelCache.clear();
    cacheVersion = version;
  }
  return labelCache;
}

/**
 * Full-line reading in hiragana. With the dictionary engine: kuromoji
 * readings (kanji resolved). Without: katakana folds to hiragana and
 * kanji passes through unchanged.
 */
export function hiraganaOf(text: string): string {
  if (!text || !hasJapanese(text)) return "";
  const engine = getJapaneseEngine();
  const cache = labelCacheForCurrentEngine();

  const hit = cache.get(`h|${text}`);
  if (hit !== undefined) return hit;

  const rendered = (engine ? engine.toHiragana(text) : kanaOnlyHiragana(text))
    .replace(/\s+/g, " ")
    .trim();
  cache.set(`h|${text}`, rendered);
  return rendered;
}

/** Romaji rendering of a line — kana converts, kanji joins via the engine. */
export function romajiOf(text: string): string {
  if (!text || !hasJapanese(text)) return "";
  const engine = getJapaneseEngine();
  const cache = labelCacheForCurrentEngine();

  const hit = cache.get(`r|${text}`);
  if (hit !== undefined) return hit;

  const rendered = toRomaji(engine ? engine.toHiragana(text) : text)
    .replace(/\s+/g, " ")
    .trim();
  cache.set(`r|${text}`, rendered);
  return rendered;
}

export type LabelMode = "off" | "romaji" | "hiragana";

/** The label a lyric line shows for the current mode ("" = none). */
export function pronunciationLabel(mode: LabelMode, text: string): string {
  if (mode === "romaji") return romajiOf(text);
  if (mode === "hiragana") {
    const hiragana = hiraganaOf(text);
    // Lines that are already kana read the same — no label needed.
    return hiragana === text ? "" : hiragana;
  }
  return "";
}

/**
 * Coarse script guess for the whole song — decides whether the label
 * toggle is worth showing. Japanese wins over the presence of embedded
 * English (normal for J-pop); everything without kana never romanizes.
 */
export function detectLanguage(lines: LyricLine[]): LyricsLanguage {
  let kana = 0;
  let hangul = 0;
  let cyrillic = 0;
  let latin = 0;

  for (const line of lines) {
    for (const char of line.text) {
      if (KANA_RANGE.test(char)) kana += 1;
      else if (HANGUL_RANGE.test(char)) hangul += 1;
      else if (CYRILLIC_RANGE.test(char)) cyrillic += 1;
      else if (LATIN_RANGE.test(char)) latin += 1;
    }
  }

  if (kana > 0) return "ja";
  if (hangul > 0) return "ko";
  if (cyrillic > 0) return "ru";
  if (latin > 0) return "latin";
  return "unknown";
}
