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
    const words: Piece[][] = [];
    for (const token of this.tokenizer.tokenize(text)) {
      if (!token.surface_form.trim()) {
        hiragana += token.surface_form;
        continue;
      }
      const read = readToken(token);
      hiragana += read.hiragana;
      const previous = words.at(-1);
      if (previous && (attaches(token) || endsInSokuon(previous))) previous.push(read.piece);
      else words.push([read.piece]);
    }
    const romaji = words.map(romajiOf).join(" ").replace(/\s+([,.!?、。！？])/g, "$1");
    const result = { hiragana, romaji };
    this.cache.set(text, result);
    return result;
  }
}
