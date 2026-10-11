import type { LyricEntry, LyricLine, LyricWord } from "@/core/lyrics/types";

// ─── LRC → timeline ───
//
// Two shapes reach the app:
// - line-synced LRC: `[mm:ss.xx]text`, with an empty `[mm:ss.xx]` marking
//   where a line ends before an instrumental break;
// - enhanced LRC: `[mm:ss.xx]<mm:ss.xx>word <mm:ss.xx>word<mm:ss.xx>` —
//   measured word timing, the trailing tag closing the last word.
// The timeline adds the interludes Apple Music shows as breathing dots: the
// intro, and breaks that are marked or are too long to be one sung line.

/** An intro shorter than this goes straight to the first line. */
export const INTRO_MIN_MS = 4_000;
/** A break shorter than this keeps the previous line lit instead of dots. */
export const BREAK_MIN_MS = 4_500;
/**
 * Unmarked gap after which a line-synced line is assumed to have ended (an
 * instrumental break the file did not mark). Shorter gaps are sung.
 */
export const UNMARKED_BREAK_MS = 14_000;
/** Generous sung length per character, bounding an unmarked line. */
const SUNG_MS_PER_CHAR = 320;
const SUNG_MIN_MS = 3_500;
const SUNG_MAX_MS = 9_000;
/** How long the last line stays lit when nothing marks its end. */
const LAST_LINE_MS = 6_000;

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/y;
const WORD_TAG = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
const OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]/im;

interface RawRow {
  startMs: number;
  /** Empty for a break marker. */
  text: string;
  words: LyricWord[] | null;
  /** A trailing word tag: when the last word ends. */
  endTagMs: number | null;
}

/** `.5` → 500 ms, `.34` → 340 ms, `.345` → 345 ms. */
function toMs(min: string, sec: string, fraction: string | undefined): number {
  const seconds = Number(sec);
  if (seconds >= 60) return Number.NaN;
  const fractionMs = fraction ? Number(fraction.padEnd(3, "0").slice(0, 3)) : 0;
  return Number(min) * 60_000 + seconds * 1_000 + fractionMs;
}

/** The leading run of `[mm:ss.xx]` stamps; metadata rows yield none. */
function leadingStamps(line: string): { stamps: number[]; body: string } {
  const stamps: number[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  TIME_TAG.lastIndex = 0;
  while ((match = TIME_TAG.exec(line)) !== null) {
    const ms = toMs(match[1], match[2], match[3]);
    if (!Number.isFinite(ms)) break;
    stamps.push(ms);
    cursor = TIME_TAG.lastIndex;
  }
  return { stamps, body: line.slice(cursor) };
}

/** Word tags inside a line body; `null` when the line has none. */
function parseWords(
  body: string,
  lineStart: number,
): { text: string; words: LyricWord[] | null; endTagMs: number | null } {
  const tags = [...body.matchAll(WORD_TAG)].map((match) => ({
    ms: toMs(match[1], match[2], match[3]),
    from: match.index,
    to: match.index + match[0].length,
  }));
  if (tags.length === 0) return { text: body.trim(), words: null, endTagMs: null };

  const segments: { text: string; startMs: number }[] = [];
  const lead = body.slice(0, tags[0].from);
  if (lead.trim()) segments.push({ text: lead, startMs: lineStart });
  tags.forEach((tag, index) => {
    const text = body.slice(tag.to, tags[index + 1]?.from ?? body.length);
    if (text.trim() && Number.isFinite(tag.ms)) segments.push({ text, startMs: tag.ms });
  });

  const last = tags.at(-1);
  const trailing = last && !body.slice(last.to).trim() ? last.ms : null;
  const words: LyricWord[] = segments.map((segment, index) => ({
    text: segment.text.trim(),
    startMs: segment.startMs,
    endMs: segments[index + 1]?.startMs ?? Number.NaN,
    spaceAfter: /\s$/.test(segment.text) || /^\s/.test(segments[index + 1]?.text ?? ""),
  }));
  const text = words.map((word) => word.text + (word.spaceAfter ? " " : "")).join("").trim();
  if (words.length < 2) return { text, words: null, endTagMs: trailing };
  return { text, words, endTagMs: trailing };
}

/** Parses an LRC document into rows sorted by time (break markers included). */
export function parseLrc(lrc: string): RawRow[] {
  const offset = Number(OFFSET_TAG.exec(lrc)?.[1] ?? 0);
  // `[offset:+500]` shows the lyrics 500 ms sooner.
  const shift = (ms: number) => Math.max(0, ms - offset);

  const rows: RawRow[] = [];
  for (const rawLine of lrc.split(/\r?\n/)) {
    const { stamps, body } = leadingStamps(rawLine.trim());
    for (const stamp of stamps) {
      const parsed = parseWords(body, stamp);
      rows.push({
        startMs: shift(stamp),
        text: parsed.text,
        words:
          parsed.words?.map((word) => ({
            ...word,
            startMs: shift(word.startMs),
            endMs: shift(word.endMs),
          })) ?? null,
        endTagMs: parsed.endTagMs == null ? null : shift(parsed.endTagMs),
      });
    }
  }

  rows.sort((a, b) => a.startMs - b.startMs);
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.startMs}|${row.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sungEstimateMs(text: string): number {
  return Math.min(SUNG_MAX_MS, Math.max(SUNG_MIN_MS, text.length * SUNG_MS_PER_CHAR));
}

/** Measured word times, closed off: every word gets an end inside the line. */
function closeWords(words: LyricWord[], lineEnd: number, endTag: number | null): LyricWord[] {
  const lastEnd = endTag ?? lineEnd;
  return words.map((word, index) => {
    const end = index === words.length - 1 ? lastEnd : word.endMs;
    return { ...word, endMs: Math.max(word.startMs, Math.min(end, lineEnd)) };
  });
}

/** When a sung row stops being lit, before the gap rule runs. */
function rowEnd(row: RawRow, next: RawRow | undefined): number {
  let endMs = next
    ? next.startMs
    : Math.max(row.endTagMs ?? row.words?.at(-1)?.startMs ?? row.startMs, row.startMs + LAST_LINE_MS);
  // The measured end of the last word bounds a word-timed line.
  if (row.words && row.endTagMs != null) endMs = Math.min(endMs, row.endTagMs);
  // A long unmarked gap: the line was sung, then the band played on.
  if (!row.words && next?.text && next.startMs - row.startMs >= UNMARKED_BREAK_MS) {
    endMs = row.startMs + sungEstimateMs(row.text);
  }
  return endMs;
}

function lineOf(row: RawRow, endMs: number): LyricLine {
  return {
    kind: "line",
    startMs: row.startMs,
    endMs,
    text: row.text,
    words: row.words ? closeWords(row.words, endMs, row.endTagMs) : null,
  };
}

/**
 * The sung lines plus interludes, sorted, each with an end. Returns an empty
 * list for a document without timed text.
 */
export function buildTimeline(rows: RawRow[]): LyricEntry[] {
  // The next row with text, for every row (a backward pass).
  const nextSung: (RawRow | undefined)[] = [];
  for (let i = rows.length - 1, after: RawRow | undefined; i >= 0; i -= 1) {
    nextSung[i] = after;
    if (rows[i].text) after = rows[i];
  }

  const entries: LyricEntry[] = [];
  const first = rows.find((row) => row.text);
  if (first && first.startMs >= INTRO_MIN_MS) {
    entries.push({ kind: "interlude", startMs: 0, endMs: first.startMs });
  }

  rows.forEach((row, i) => {
    if (!row.text) return;
    const endMs = rowEnd(row, rows[i + 1]);
    const following = nextSung[i];
    const gap = following ? following.startMs - endMs : 0;
    if (following && gap >= BREAK_MIN_MS) {
      entries.push(lineOf(row, endMs), { kind: "interlude", startMs: endMs, endMs: following.startMs });
    } else {
      // Short gap: the line stays lit until the next one starts.
      entries.push(lineOf(row, following ? following.startMs : endMs));
    }
  });
  return entries;
}

/** Index of the entry playing at `positionMs` (`-1` before the first, `length` after the last). */
export function entryIndexAt(entries: readonly { startMs: number; endMs: number }[], positionMs: number): number {
  "worklet";
  let low = 0;
  let high = entries.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (entries[mid].startMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (found === entries.length - 1 && found >= 0 && positionMs >= entries[found].endMs) {
    return entries.length;
  }
  return found;
}

/** A stable key for an entry: rows are unique by start and text (see `parseLrc`). */
export function entryKey(entry: LyricEntry): string {
  return entry.kind === "line" ? `line:${entry.startMs}:${entry.text}` : `break:${entry.startMs}`;
}

/** Display lines with stable keys: a repeated line (a chorus) counts its occurrences. */
export function keyedLines(lines: readonly string[]): { key: string; text: string }[] {
  const seen = new Map<string, number>();
  return lines.map((text) => {
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return { key: `${text}#${count}`, text };
  });
}

/** Untimed lyrics as display lines; runs of blank lines collapse to one stanza gap. */
export function plainLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (line || (lines.length > 0 && lines.at(-1) !== "")) lines.push(line);
  }
  while (lines.at(-1) === "") lines.pop();
  return lines;
}

/** Synced lyrics flattened to untimed lines (a different cut of the song). */
export function syncedToPlain(lrc: string): string[] {
  return parseLrc(lrc).map((row) => row.text).filter(Boolean);
}
