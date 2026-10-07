import { isKana, toHiragana, toRomaji } from "wanakana";
import type { JapaneseTokenizer, KuromojiToken } from "@/core/japanese/tokenizer";

/** Particles read differently from how they are written. */
const PARTICLE_ROMAJI: Record<string, string> = { "は": "wa", "へ": "e", "を": "o" };

const hasReading = (value: string | undefined): value is string => Boolean(value) && value !== "*";

/** Parts of speech that join the previous word (`tabe` + `te`, `iki` + `masu`). */
const ATTACHED_POS = new Set(["助動詞", "記号"]);
const ATTACHED_DETAIL = new Set(["接尾", "非自立", "接続助詞"]);

function attaches(token: KuromojiToken): boolean {
  return ATTACHED_POS.has(token.pos) || ATTACHED_DETAIL.has(token.pos_detail_1);
}

/** One token as hiragana and romaji (a Latin token stays as written). */
function readToken(token: KuromojiToken): { hiragana: string; romaji: string } {
  const surface = token.surface_form;
  const kana = hasReading(token.reading) ? token.reading : surface;
  if (!isKana(kana)) return { hiragana: surface, romaji: surface };
  const particle = token.pos === "助詞" ? PARTICLE_ROMAJI[surface] : undefined;
  return { hiragana: toHiragana(kana), romaji: particle ?? toRomaji(kana) };
}

/**
 * Readings of Japanese text with kanji resolved (kuromoji + IPADIC): the
 * hiragana a learner reads, and Hepburn-style romaji split into words.
 */
export class JapaneseReader {
  private readonly cache = new Map<string, { hiragana: string; romaji: string }>();

  constructor(private readonly tokenizer: JapaneseTokenizer) {}

  /** The whole line in hiragana (`君の名は` → `きみのなは`). */
  hiragana(text: string): string {
    return this.read(text).hiragana;
  }

  /** The line in romaji, word by word (`君の名は` → `kimi no na wa`). */
  romaji(text: string): string {
    return this.read(text).romaji;
  }

  private read(text: string): { hiragana: string; romaji: string } {
    const hit = this.cache.get(text);
    if (hit) return hit;
    let hiragana = "";
    const words: string[] = [];
    for (const token of this.tokenizer.tokenize(text)) {
      if (!token.surface_form.trim()) {
        hiragana += token.surface_form;
        continue;
      }
      const read = readToken(token);
      hiragana += read.hiragana;
      if (words.length > 0 && attaches(token)) words[words.length - 1] += read.romaji;
      else words.push(read.romaji);
    }
    const result = { hiragana, romaji: words.join(" ").replace(/\s+([,.!?、。！？])/g, "$1") };
    this.cache.set(text, result);
    return result;
  }
}
