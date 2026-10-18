// ─── Search-text folding ───
//
// One folded form backs every comparison here, so de-duplication, the
// recent-search filter and the results highlight all agree on what "matches":
// case, accents and runs of whitespace stop mattering.

/** Combining marks left over from `NFD` — the accents `ç`/`ã` decompose into. */
const COMBINING_MARKS = /\p{M}/gu;

/** Lowercase + strip diacritics (NFD, remove \p{M}) + collapse whitespace. */
export function foldForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `foldForSearch` without the whitespace pass: a lone space must stay a space
 * (and a bare combining mark must fold to nothing) while `findMatchRange` walks
 * the haystack character by character.
 */
function foldChar(char: string): string {
  return char.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}

/** A folded string plus the original span each folded character came from. */
interface FoldedText {
  /** The folded characters, whitespace collapsed and ends trimmed. */
  text: string;
  starts: number[];
  ends: number[];
}

/**
 * Folds `text` while remembering, for every folded character, which original
 * character produced it. Whitespace collapses the same way `foldForSearch`
 * collapses it (runs become one space, the ends are trimmed) and those spaces
 * are mapped to the whitespace they replaced.
 */
function foldWithSpans(text: string): FoldedText {
  const folded: FoldedText = { text: "", starts: [], ends: [] };
  /** Whitespace seen but not folded yet — paste it only if a word follows. */
  let pendingSpace: { start: number; end: number } | null = null;
  let index = 0;

  const append = (piece: string, start: number, end: number) => {
    if (pendingSpace) {
      folded.text += " ";
      folded.starts.push(pendingSpace.start);
      folded.ends.push(pendingSpace.end);
      pendingSpace = null;
    }
    folded.text += piece;
    // One entry per UTF-16 unit, the unit the folded text is indexed in.
    folded.starts.push(...Array.from({ length: piece.length }, () => start));
    folded.ends.push(...Array.from({ length: piece.length }, () => end));
  };

  for (const char of text) {
    const charStart = index;
    const charEnd = charStart + char.length;
    index = charEnd;
    const piece = foldChar(char);
    if (!piece) continue; // A bare combining mark folds to nothing.

    if (/^\s+$/.test(piece)) {
      if (folded.text) pendingSpace = { start: charStart, end: charEnd };
    } else {
      append(piece, charStart, charEnd);
    }
  }

  return folded;
}

/**
 * Range of `needle` inside `haystack`, in ORIGINAL haystack string indices,
 * case/accent-insensitive, or null. Empty/whitespace needle → null.
 *
 * Folding changes lengths (`ç` → `c`, a decomposed accent loses its mark), so
 * the folded haystack is built one original character at a time, carrying the
 * index that character occupies. Callers can therefore slice the original text
 * to highlight a match. Whitespace is collapsed on both sides, which keeps
 * `"  do "` matching `"ação do mal"`.
 */
export function findMatchRange(
  haystack: string,
  needle: string,
): { start: number; end: number } | null {
  const foldedNeedle = foldForSearch(needle);
  if (!foldedNeedle) return null;

  const folded = foldWithSpans(haystack);
  const at = folded.text.indexOf(foldedNeedle);
  if (at < 0) return null;
  return {
    start: folded.starts[at],
    end: folded.ends[at + foldedNeedle.length - 1],
  };
}

/** Whether `needle` starts a word of `text` (both folded) past its start. */
function startsAWord(text: string, needle: string): boolean {
  for (
    let at = text.indexOf(needle, 1);
    at > 0;
    at = text.indexOf(needle, at + 1)
  ) {
    if (!/[\p{L}\p{N}]/u.test(text[at - 1])) return true;
  }
  return false;
}

/**
 * How well `query` matches `needle` (both folded), best first: the very same
 * words, a prefix, the start of a later word ("naruto" in "Boruto: Naruto"),
 * anywhere. Null when it doesn't contain it at all.
 */
function matchTier(query: string, needle: string): number | null {
  if (query === needle) return 0;
  if (query.startsWith(needle)) return 1;
  if (startsAWord(query, needle)) return 2;
  return query.includes(needle) ? 3 : null;
}

/**
 * Entries whose query contains `typed` (fold-insensitive), strongest matches
 * first — exact, prefix, word start, anywhere (see `matchTier`). Each tier
 * keeps the input order, so callers rank by recency/frequency beforehand.
 * Empty typed → all items.
 */
export function filterByQuery<T>(
  items: readonly T[],
  typed: string,
  getQuery: (item: T) => string,
): T[] {
  const folded = foldForSearch(typed);
  if (!folded) return [...items];

  const tiers: T[][] = [[], [], [], []];
  for (const item of items) {
    const tier = matchTier(foldForSearch(getQuery(item)), folded);
    if (tier !== null) tiers[tier].push(item);
  }
  return tiers.flat();
}
