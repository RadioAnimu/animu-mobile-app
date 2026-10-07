import { toRomaji } from "wanakana";

// ─── Text normalization & similarity ───
//
// Station titles and lyrics-database titles disagree on everything: script
// (ヒバナ / Hibana, 新時代 / Shin Jidai), width (ＡＢＣ / ABC), name order
// (Horie Yui / Yui Horie), where the title sits (`Rude-α 『LIFE』`,
// `残響散歌 - Zankyosanka`) and what rides along (`feat. …`, `(CV: …)`).
// Both sides go through the same pipeline before any comparison.

/**
 * Turns Japanese text into romaji. Kana always converts; kanji only with a
 * reader that knows their readings (the offline dictionary).
 */
export type Romanizer = (text: string) => string;

export const kanaRomanizer: Romanizer = (text) => toRomaji(text);

const BRACKETS = /[([{【「『≪〈《［（]([^)\]}】」』≫〉》］）]*)[)\]}】」』≫〉》］）]/g;
const TILDE_SUFFIX = /[~〜～]([^~〜～]*)[~〜～]?/g;
const FEATURING = /\s(?:feat\.?|ft\.?|featuring|prod\.?)\s.*$/i;
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;
/**
 * Words that only qualify a song (`(Opening)`, `(TV Size)`): a part made of
 * them never stands for the title on its own.
 */
const QUALIFIER_WORDS = new Set(
  "tv full short movie game anime english korean japanese chinese album single original op ed opening ending insert song theme size ver version edit mix remaster remastered".split(" "),
);

const isQualifierOnly = (normalized: string): boolean =>
  normalized.split(" ").every((word) => QUALIFIER_WORDS.has(word) || /^\d+$/.test(word));

/** NFKC, lowercase, romanized; punctuation becomes spaces. */
export function normalize(input: string, romanize: Romanizer = kanaRomanizer): string {
  const folded = input.normalize("NFKC").toLowerCase();
  return romanize(folded).toLowerCase().replace(PUNCTUATION, " ").replace(/\s+/g, " ").trim();
}

/** Letters and digits only: `shin jidai` and `shinjidai` compare equal. */
export function compact(normalized: string): string {
  return normalized.replace(/\s+/g, "");
}

/**
 * The ways a title can be written, normalized: the whole string, the string
 * without its bracketed/tilde qualifiers or `feat.` tail, every bracketed or
 * tilde-wrapped part (`Rude-α 『LIFE』` → `life`) and both sides of a ` - `
 * split.
 */
export function titleVariants(title: string, romanize: Romanizer = kanaRomanizer): string[] {
  const raw = title.normalize("NFKC");
  const core = raw.replace(BRACKETS, " ").replace(TILDE_SUFFIX, " ").replace(FEATURING, " ");
  const parts: string[] = [];
  for (const match of raw.matchAll(BRACKETS)) parts.push(match[1]);
  for (const match of raw.matchAll(TILDE_SUFFIX)) parts.push(match[1]);
  for (const piece of [raw, core]) parts.push(...piece.split(/\s[-–—/|]\s/));

  // The whole title always counts; a part only when it is more than a qualifier.
  const variants = new Set<string>([normalize(raw, romanize), normalize(core, romanize)]);
  for (const part of parts) {
    const normalized = normalize(part, romanize);
    if (!isQualifierOnly(normalized)) variants.add(normalized);
  }
  variants.delete("");
  return [...variants];
}

/** Separators between credited names (`A feat. B`, `A & B`, `A、B`…). */
const ARTIST_SEPARATOR = /[&＆/、,;×]/;
const ARTIST_WORD_SEPARATOR = /\s(?:feat\.?|ft\.?|featuring|with|vs\.?|x|and|from)\s/i;

function splitCredits(credits: string): string[] {
  return credits.split(ARTIST_SEPARATOR).flatMap((part) => part.split(ARTIST_WORD_SEPARATOR));
}
/** `Hachiman Hikigaya (CV: Takuya Eguchi)` credits the voice actor too. */
const CHARACTER_VOICE = /[(（]\s*(?:cv|vo)\s*[.:：]\s*([^)）]+)[)）]/gi;

/** Every credited name, normalized, plus the whole credit. */
export function artistNames(artist: string, romanize: Romanizer = kanaRomanizer): string[] {
  const raw = artist.normalize("NFKC");
  const voices = [...raw.matchAll(CHARACTER_VOICE)].map((match) => match[1]);
  const credits = raw.replace(CHARACTER_VOICE, " ");
  const names = new Set<string>();
  for (const part of [credits, ...splitCredits(credits), ...voices]) {
    const normalized = normalize(part.replace(BRACKETS, " "), romanize);
    if (normalized) names.add(normalized);
  }
  return [...names];
}

/** Levenshtein ratio in [0, 1] — 1 means identical. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let current = Array.from<number>({ length: b.length + 1 });
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    [previous, current] = [current, previous];
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

/** Same words in any order (`horie yui` / `yui horie`). */
export function sameTokens(a: string, b: string): boolean {
  const sort = (value: string) => value.split(" ").filter(Boolean).sort().join(" ");
  return Boolean(a) && sort(a) === sort(b);
}

/** Best similarity over two variant lists, on the compact forms. */
export function bestSimilarity(left: readonly string[], right: readonly string[]): number {
  let best = 0;
  for (const a of left) {
    for (const b of right) {
      if (sameTokens(a, b)) return 1;
      best = Math.max(best, similarity(compact(a), compact(b)));
    }
  }
  return best;
}

/** Whether the text contains kanji (needs a reader to romanize). */
export function hasKanji(text: string): boolean {
  return /[㐀-䶿一-鿿豈-﫿]/.test(text);
}
