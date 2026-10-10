import { toHiragana } from "wanakana";
import type { LyricWord } from "@/core/lyrics/types";

// ─── Readings word by word ───
//
// Apple Music sets each word's reading under the word itself (この痛み / さえ /
// も over kono itami / sae / mo). A reading comes as a line ("kono itami sae
// mo", human romaji) or as words (the dictionary); a line is split onto the
// Japanese by its kana: the kana it spells must appear in the Japanese text,
// in order, with each kanji run standing for one or more syllables.

/** A piece of a line with its reading (`""` when it needs none). */
export interface LabelSegment {
  text: string;
  label: string;
  /** A space separates it from the next piece in the line. */
  spaceAfter: boolean;
}

/** A segment of the active line with its sung time span (from the word timing). */
export interface TimedSegment extends LabelSegment {
  startMs: number;
  endMs: number;
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/;
const LATIN = /[a-z0-9]/i;
/** Punctuation a reading drops: it stays on the Japanese piece before it. */
const PUNCTUATION = /[\s、。，．・！？!?,.「」『』（）()〜~…:;"'“”‘’-]/;
/** Particles written as they sound in romaji (は → wa, を → o, へ → e). */
const SOUNDS_LIKE: Record<string, string> = { "は": "[はわ]", "を": "[をお]", "へ": "[へえ]" };

/** Katakana → hiragana, keeping length (so offsets into the text stay valid). */
function foldKana(text: string): string {
  let folded = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    folded += code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : char;
  }
  return folded;
}

const escapeRegExp = (char: string) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Punctuation that closes what came before (it stays on the previous piece). */
const CLOSING = /[、。，．！？!?,.」』）)〜~…:;"'”’]/;

/** Whether `piece` of the Japanese line can be read as `word` (a romaji word). */
function reads(piece: string, word: string): boolean {
  const letters = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!letters) return false;
  const core = [...piece].filter((char) => !PUNCTUATION.test(char)).join("");
  if (!core) return false;
  // English inside a Japanese line reads as itself (I'll ↔ I'll).
  if (LATIN.test(core)) return core.toLowerCase() === letters;
  let pattern = "";
  let inKanji = false;
  for (const char of foldKana(core)) {
    if (KANJI.test(char)) {
      if (!inKanji) pattern += ".+";
      inKanji = true;
      continue;
    }
    inKanji = false;
    if (char === "ー") pattern += "[あいうえおー]";
    else pattern += SOUNDS_LIKE[char] ?? escapeRegExp(char);
  }
  return new RegExp(`^${pattern}$`).test(toHiragana(letters));
}

/** Hepburn macrons as the kana spell them (mō → mou, ī → ii). */
const MACRONS: Record<string, string> = { "ā": "aa", "ī": "ii", "ū": "uu", "ē": "ee", "ō": "ou" };

/** Words of a romaji line as written (shown), and as spelled for matching. */
function romajiWords(line: string): { shown: string; spelled: string }[] {
  return line
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, ""))
    .filter(Boolean)
    .map((shown) => ({
      shown,
      spelled: shown
        .normalize("NFC")
        .replace(/[āīūēō]/gi, (vowel) => MACRONS[vowel.toLowerCase()])
        .normalize("NFKC"),
    }));
}

/**
 * Splits a human romaji line onto the Japanese line, word by word — or
 * `null` when they do not line up (the line then keeps one label).
 */
export function alignRomaji(text: string, romaji: string): LabelSegment[] | null {
  const words = romajiWords(romaji);
  if (words.length === 0) return null;
  // Full-width digits and Latin compare as their half-width selves (same length).
  const shown = [...text];
  const chars = shown.map((char) => (/[０-９Ａ-Ｚａ-ｚ]/.test(char) ? char.normalize("NFKC") : char));

  const spaceAt = (at: number) => at < chars.length && /\s/.test(chars[at]);
  const skipSpaces = (from: number) => {
    let at = from;
    while (spaceAt(at)) at += 1;
    return at;
  };
  /** Where the piece starting at `from` must end at the latest: the next space. */
  const spaceAfter = (from: number) => {
    let at = from;
    while (at < chars.length && !spaceAt(at)) at += 1;
    return at;
  };
  const onlyPunctuation = (from: number) => chars.slice(from).every((char) => PUNCTUATION.test(char));

  // Backtracking over where each word ends. A place already shown not to
  // work is remembered: a near-miss line stays polynomial, never exponential.
  const failed = new Set<string>();
  const place = (word: number, start: number): LabelSegment[] | null => {
    if (word === words.length) return onlyPunctuation(start) ? [] : null;
    const here = `${word}:${start}`;
    if (failed.has(here)) return null;
    const limit = spaceAfter(start);
    for (let end = start + 1; end <= limit; end += 1) {
      if (reads(chars.slice(start, end).join(""), words[word].spelled)) {
        let tail = end;
        while (tail < limit && CLOSING.test(chars[tail])) tail += 1;
        const next = skipSpaces(tail);
        const rest = place(word + 1, next);
        if (rest) {
          const segment = { text: shown.slice(start, tail).join(""), label: words[word].shown, spaceAfter: next > tail };
          return [segment, ...rest];
        }
      }
    }
    failed.add(here);
    return null;
  };

  return place(0, skipSpaces(0));
}

/**
 * The active line's segments with their sung span, from its word timing
 * (a segment spans the timed words it covers). `null` when the texts
 * disagree.
 */
export function timeSegments(segments: readonly LabelSegment[], words: readonly LyricWord[]): TimedSegment[] | null {
  const compact = (value: string) => value.replace(/\s+/g, "");
  // Character spans of the timed words, on the line without spaces.
  const spans: { from: number; to: number; word: LyricWord }[] = [];
  let at = 0;
  for (const word of words) {
    const length = compact(word.text).length;
    spans.push({ from: at, to: at + length, word });
    at += length;
  }
  const timed: TimedSegment[] = [];
  let from = 0;
  for (const segment of segments) {
    const to = from + compact(segment.text).length;
    const covered = spans.filter((span) => span.from < to && span.to > from);
    if (covered.length === 0) return null;
    timed.push({ ...segment, startMs: covered[0].word.startMs, endMs: covered[covered.length - 1].word.endMs });
    from = to;
  }
  return from === at ? timed : null;
}
