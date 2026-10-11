import { isKana, toHiragana, toRomaji } from "wanakana";
import type { JapaneseTokenizer, KuromojiToken } from "@/core/japanese/tokenizer";

/** Particles read differently from how they are written. */
const PARTICLE_ROMAJI: Record<string, string> = { "は": "wa", "へ": "e", "を": "o" };

const hasReading = (value: string | undefined): value is string => Boolean(value) && value !== "*";

/**
 * Parts of speech that join the previous word (`tabe` + `te`, `iki` + `masu`,
 * `se` + `zu`). Dependent nouns and verbs (の, いる) stay words of their own:
 * `hoshii no sa`, `mite ita` — Apple Music's split.
 */
const ATTACHED_POS = new Set(["助動詞", "記号"]);
const ATTACHED_DETAIL = new Set(["接尾", "接続助詞"]);

function attaches(token: KuromojiToken): boolean {
  return ATTACHED_POS.has(token.pos) || ATTACHED_DETAIL.has(token.pos_detail_1);
}

/**
 * A word's pieces: kana (romanized together, so a small っ at the end of one
 * token doubles the next one's consonant — なっ + て → natte) or text kept as
 * written (Latin, particles said differently from how they are written).
 */
type Piece = { kana: string } | { literal: string };

/** One token as hiragana and as a piece of its word. */
function readToken(token: KuromojiToken): { hiragana: string; piece: Piece } {
  const surface = token.surface_form;
  const kana = hasReading(token.reading) ? token.reading : surface;
  if (!isKana(kana)) return { hiragana: surface, piece: { literal: surface } };
  const particle = token.pos === "助詞" ? PARTICLE_ROMAJI[surface] : undefined;
  return { hiragana: toHiragana(kana), piece: particle ? { literal: particle } : { kana } };
}

/** A word cannot end on a small っ: it doubles what follows (行っ + ちゃった). */
function endsInSokuon(pieces: Piece[]): boolean {
  const last = pieces.at(-1);
  return last != null && "kana" in last && /[っッ]$/.test(last.kana);
}

/** A word's romaji: runs of kana romanized as one. */
function romajiOf(pieces: Piece[]): string {
  let romaji = "";
  let kana = "";
  for (const piece of pieces) {
    if ("kana" in piece) {
      kana += piece.kana;
      continue;
    }
    romaji += toRomaji(kana) + piece.literal;
    kana = "";
  }
  return romaji + toRomaji(kana);
}

/**
 * Readings of Japanese text with kanji resolved (kuromoji + IPADIC): the
 * hiragana a learner reads, and Hepburn-style romaji split into words.
 */
/** A word of a line as the dictionary reads it. */
export interface ReadWord {
  /** The word as written (punctuation after it included). */
  text: string;
  hiragana: string;
  romaji: string;
  /** A space follows it in the line. */
  spaceAfter: boolean;
}

interface WordBuilder {
  text: string;
  hiragana: string;
  pieces: Piece[];
  spaceAfter: boolean;
}

export class JapaneseReader {
  private readonly cache = new Map<string, ReadWord[]>();

  constructor(private readonly tokenizer: JapaneseTokenizer) {}

  /** The whole line in hiragana (`君の名は` → `きみのなは`). */
  hiragana(text: string): string {
    return this.words(text)
      .map((word) => word.hiragana + (word.spaceAfter ? " " : ""))
      .join("")
      .trim();
  }

  /** The line in romaji, word by word (`君の名は` → `kimi no na wa`). */
  romaji(text: string): string {
    return this.words(text)
      .map((word) => word.romaji)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.!?、。！？])/g, "$1");
  }

  /**
   * The line word by word (`この痛みさえも` → この / 痛み / さえ / も), each with
   * its readings — what goes under each word, Apple Music style.
   */
  words(text: string): ReadWord[] {
    const hit = this.cache.get(text);
    if (hit) return hit;
    const words: WordBuilder[] = [];
    for (const token of this.tokenizer.tokenize(text)) {
      const previous = words.at(-1);
      if (!token.surface_form.trim()) {
        if (previous) previous.spaceAfter = true;
        continue;
      }
      const read = readToken(token);
      if (previous && !previous.spaceAfter && (attaches(token) || endsInSokuon(previous.pieces))) {
        previous.text += token.surface_form;
        previous.hiragana += read.hiragana;
        previous.pieces.push(read.piece);
      } else {
        words.push({ text: token.surface_form, hiragana: read.hiragana, pieces: [read.piece], spaceAfter: false });
      }
    }
    const result = words.map(({ text: written, hiragana, pieces, spaceAfter }) => ({
      text: written,
      hiragana,
      romaji: romajiOf(pieces).replace(/[、。！？]/g, ""),
      spaceAfter,
    }));
    this.cache.set(text, result);
    return result;
  }
}
