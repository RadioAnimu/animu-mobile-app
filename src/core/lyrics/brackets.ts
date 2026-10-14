/** Leftmost bracket groups, including nested openers, without regex backtracking. */
export function bracketGroups(text: string, opening: string, closing: string): { from: number; to: number; text: string }[] {
  const opens = new Set(opening);
  const closes = new Set(closing);
  const groups: { from: number; to: number; text: string }[] = [];
  let from = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (from < 0) {
      if (opens.has(text[i])) from = i;
      continue;
    }
    if (closes.has(text[i])) {
      groups.push({ from, to: i + 1, text: text.slice(from + 1, i) });
      from = -1;
    }
  }
  return groups;
}

export function withoutBracketGroups(text: string, groups: readonly { from: number; to: number }[]): string {
  const pieces: string[] = [];
  let cursor = 0;
  for (const group of groups) {
    pieces.push(text.slice(cursor, group.from), " ");
    cursor = group.to;
  }
  pieces.push(text.slice(cursor));
  return pieces.join("");
}
