import { toRomaji } from "wanakana";

// ─── Text normalization & similarity ───
//
// Radio titles and lyrics-database titles disagree on everything: script
// (ヒバナ vs Hibana), notation (full-width ｖｓ half-width), parenthesized
// qualifiers ("TV Size", "off vocal"), and junk suffixes ("Official MV").
// Matching normalizes BOTH sides through the same pipeline before any
// string comparison happens.

const BRACKETED =
  /\(([^)]*)\)|\[((?:[^\[\]\\]|\[[^\]]*\])*)\]|【([^】]*)】|「([^」]*)」|≪([^≫]*)≫/g;

const QUALIFIER_WORDS =
  /(\b(tv|mv|pv|cm)?\s?(size|version|ver\.?|edit|mix|remaster(ed)?|off\s?vocal|inst(rumental)?|short|full|long|loop|tv|movie|game|anime|op|ed|opening|ending)\b)/g;

const FEAT_SPLIT =
  /\s*(?:feat\.?|ft\.?|featuring|with|vs\.?|x|×|＆|&|\/|、|,|\bby\b)\s*/i;

/**
 * Normalized comparison form of a title/artist string:
 * NFKC (full→half width), lowercased, bracketed qualifiers dropped,
 * kana transliterated so ヒバナ and Hibana land on the same string.
 * Kanji survives (CJK ideographs are letters under \p{L}), so 紅蓮華
 * keeps comparing against 紅蓮華 even though it can't be romanized.
 */
export function normalizeText(input: string): string {
  const base = (input ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(BRACKETED, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(QUALIFIER_WORDS, " ");

  const romaji = toRomaji(base);
  const flattened = (romaji.length > 0 ? romaji : base)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // A title that lives entirely inside brackets ("YOASOBI「アイドル」")
  // would normalize to the wrapper alone — fall back to the unstripped form.
  if (flattened.length === 0) {
    return normalizeLoose(input);
  }
  return flattened;
}

function normalizeLoose(input: string): string {
  return toRomaji(
    (input ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein ratio in [0, 1] — 1 means identical. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxDistance = Math.max(a.length, b.length);
  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution =
        previous[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1);
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        substitution,
      );
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return 1 - previous[b.length] / maxDistance;
}

function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

/** Jaccard overlap of the token sets — order-free fuzzy containment. */
export function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }
  return shared / (tokensA.size + tokensB.size - shared);
}

/** Best score of `needle` tokens appearing inside `haystack` tokens. */
export function containment(needle: string, haystack: string): number {
  const needleTokens = tokenize(needle);
  const haystackTokens = new Set(tokenize(haystack));
  if (needleTokens.length === 0 || haystackTokens.size === 0) return 0;

  let found = 0;
  for (const token of needleTokens) {
    if (haystackTokens.has(token)) found += 1;
  }
  return found / needleTokens.length;
}

/**
 * Comparable artist variants: the full name with roles stripped, plus
 * each split-off name ("A feat. B" → ["a", "b"] style candidates) so a
 * main-artist-only credit still matches.
 */
export function artistVariants(artist: string): string[] {
  const cleaned = (artist ?? "").normalize("NFKC").toLowerCase();
  const parts = cleaned
    .split(FEAT_SPLIT)
    .map((part) => part.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);

  const variants = new Set<string>([
    ...parts,
    normalizeText(cleaned),
    ...parts.map(normalizeText),
  ]);
  variants.delete("");
  return [...variants];
}

/** Same-title junk uploads ("Official Music Video", "nightcore", covers). */
const JUNK_MARKERS =
  /(official music video|official video|music video|\bmv\b|\bpv\b|nightcore|cover|cover(ed)?\s?by|歌ってみた|弾いてみた|remix|full\s?ver\.?|without\s?vocal)/;

export function looksLikeJunk(candidateText: string): boolean {
  return JUNK_MARKERS.test((candidateText ?? "").toLowerCase());
}
