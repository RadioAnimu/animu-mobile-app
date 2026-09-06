// ─── Japanese transliteration engine registry ───
//
// Romaji/furigana rendering has two tiers: kana-only (always available,
// wanakana) and full readings (kanji → hiragana via the kuromoji
// tokenizer, only after the user downloads the offline dictionary).
// The dictionary manager installs the full engine here when it's ready;
// a version counter lets consumers invalidate their per-line caches the
// moment the engine appears or disappears.

export interface JapaneseTransliterator {
  /** Full reading of a mixed-script line in hiragana (kanji included). */
  toHiragana(text: string): string;
}

/** Hiragana block end for katakana folding; katakana ー (length mark) stays. */
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;

/** Katakana → hiragana; every other script passes through untouched. */
export function katakanaToHiragana(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    result +=
      code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - 0x60)
        : char;
  }
  return result;
}

let engine: JapaneseTransliterator | null = null;
let engineVersion = 0;

/** Installs (or removes, with null) the kuromoji-backed engine. */
export function setJapaneseEngine(next: JapaneseTransliterator | null): void {
  engine = next;
  engineVersion += 1;
}

export function getJapaneseEngine(): JapaneseTransliterator | null {
  return engine;
}

/** Bumps whenever the engine is installed/removed — cache-busting key. */
export function getJapaneseEngineVersion(): number {
  return engineVersion;
}
