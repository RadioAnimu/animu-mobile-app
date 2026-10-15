// ─── Bracketed qualifiers in song metadata ───
//
// Titles and credits carry qualifiers in brackets: `Sanctuary (Opening)`,
// `Rude-α 『LIFE』`, `Hachiman (CV: Takuya Eguchi)`. A regex such as
// `[(]([^)]*)[)]` finds them, but on a title with an opener and no closer it
// rescans to the end from every opener, which is quadratic on long external
// metadata. This scans once.

/** One bracketed group: `from`/`to` span the brackets, `inner` is between them. */
export interface BracketGroup {
  from: number;
  to: number;
  inner: string;
}

/**
 * The bracketed groups of `text`, left to right. Each opener runs to the first
 * closer after it, whatever its kind and with other openers in between
 * (`Song (TV (Size))` → `TV (Size`), as `[open][^close]*[close]` matches. An
 * opener with no closer after it ends the scan.
 */
export function bracketGroups(text: string, opening: string, closing: string): BracketGroup[] {
  const groups: BracketGroup[] = [];
  let from = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (from < 0) {
      if (opening.includes(text[i])) from = i;
      continue;
    }
    if (closing.includes(text[i])) {
      groups.push({ from, to: i + 1, inner: text.slice(from + 1, i) });
      from = -1;
    }
  }
  return groups;
}

/** `text` with each group (brackets included) replaced by a space. */
export function withoutGroups(text: string, groups: readonly BracketGroup[]): string {
  let result = "";
  let cursor = 0;
  for (const group of groups) {
    result += `${text.slice(cursor, group.from)} `;
    cursor = group.to;
  }
  return result + text.slice(cursor);
}
