import type { LyricLine, LyricWord } from "./types";

// ─── LRC parsing ───
//
// Two lyric shapes reach the player:
// - standard LRC: `[mm:ss.xx]line` — line-level sync only;
// - enhanced LRC (A2): `[mm:ss.xx]<mm:ss.xx>word <mm:ss.xx>word` — real
//   word-level karaoke.
// Both are parsed here; when a line has no measured word tags, karaoke
// prep estimates word times by spreading the line's window across words
// proportionally to their length (the feel is per-word either way).

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG = /<(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;

/** Fractions: `.34` is hundredths (→340ms), `.345` is already milliseconds. */
function toMs(min: string, sec: string, fraction: string | undefined): number {
  const minutes = Number(min);
  const seconds = Number(sec);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return NaN;
  let millis = 0;
  if (fraction) {
    millis = fraction.length === 3 ? Number(fraction) : Number(fraction) * 10;
  }
  return minutes * 60_000 + seconds * 1_000 + millis;
}

/** Collects the leading run of adjacent time tags; metadata rows collect none. */
function collectLeadingStamps(trimmed: string): { stamps: number[]; bodyStart: number } {
  const stamps: number[] = [];
  let cursor = 0;
  for (;;) {
    TIME_TAG.lastIndex = cursor;
    const match = TIME_TAG.exec(trimmed);
    if (!match || match.index !== cursor) break;
    const ms = toMs(match[1], match[2], match[3]);
    if (!Number.isFinite(ms)) break;
    stamps.push(ms);
    cursor = TIME_TAG.lastIndex;
  }
  return { stamps, bodyStart: cursor };
}

/**
 * Parses an LRC document into sorted lyric lines. Metadata tags, empty
 * lines and unparsable rows are dropped; multi-timestamp rows expand.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const offsetMatch = OFFSET_TAG.exec(lrc ?? "");
  const offsetMs = offsetMatch ? Number(offsetMatch[1]) : 0;

  const lines: LyricLine[] = [];
  for (const rawLine of (lrc ?? "").split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;

    const { stamps, bodyStart } = collectLeadingStamps(trimmed);
    if (stamps.length === 0) continue;

    const text = trimmed.slice(bodyStart).trim();
    if (text.length === 0) continue;

    for (const stamp of stamps) {
      const shifted = (ms: number) => Math.max(0, ms - offsetMs);
      const words = parseWordTags(text, stamp);
      lines.push({
        timeMs: shifted(stamp),
        text,
        words: words.map((word) => ({ ...word, startMs: shifted(word.startMs) })),
        wordTimed: words.length > 1,
      });
    }
  }

  lines.sort((a, b) => a.timeMs - b.timeMs);
  return dedupe(lines);
}

/** `<mm:ss.xx>word` segments; text before the first tag inherits the line stamp. */
function parseWordTags(text: string, lineStamp: number): LyricWord[] {
  WORD_TAG.lastIndex = 0;
  const tags: { ms: number; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = WORD_TAG.exec(text)) !== null) {
    const ms = toMs(match[1], match[2], match[3]);
    if (Number.isFinite(ms)) tags.push({ ms, index: match.index });
  }
  if (tags.length === 0) return [{ text: text.trim(), startMs: lineStamp }];

  const words: LyricWord[] = [];
  const prefix = text.slice(0, tags[0].index).trim();
  if (prefix.length > 0) words.push({ text: prefix, startMs: lineStamp });

  for (let i = 0; i < tags.length; i += 1) {
    const wordStart = text.indexOf(">", tags[i].index) + 1;
    const end = i + 1 < tags.length ? tags[i + 1].index : text.length;
    const word = text.slice(wordStart, end).trim();
    if (word.length > 0) words.push({ text: word, startMs: tags[i].ms });
  }
  return words;
}

function dedupe(lines: LyricLine[]): LyricLine[] {
  const seen = new Set<string>();
  const unique: LyricLine[] = [];
  for (const line of lines) {
    const key = `${line.timeMs}|${line.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return unique;
}

// ─── Karaoke prep ───
//
// Every line leaves this module word-timed. Measured tags win; otherwise
// the line's window (its own start → next line's start, bounded by a
// length-based estimate) is spread across words weighted by char count.

const MIN_LINE_WINDOW_MS = 600;
const ESTIMATE_MS_PER_CHAR = 280;
const ESTIMATE_MIN_MS = 1_800;
const ESTIMATE_MAX_MS = 8_000;
const NEXT_LINE_MARGIN_MS = 150;

/**
 * Returns lines guaranteed to carry word timings (measured or estimated),
 * ready for the karaoke renderer.
 */
export function prepareKaraoke(lines: LyricLine[]): LyricLine[] {
  const prepared: LyricLine[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];

    if (line.wordTimed && line.words.length > 1) {
      prepared.push({ ...line, ...anchorWords(line) });
      continue;
    }

    const windowEnd = estimateWindowEnd(line, next);
    prepared.push({
      ...line,
      wordTimed: false,
      words: spreadWords(line, windowEnd),
    });
  }
  return prepared;
}

/**
 * Measured word tags are song-absolute in the standard, but some uploads
 * repeat line-relative times inside every line. A line whose first word
 * lags behind (or leaps absurdly ahead of) its own stamp is treated as
 * line-relative and re-anchored onto the line's start.
 */
function anchorWords(line: LyricLine): { words: LyricWord[]; wordTimed: boolean } {
  const first = line.words[0].startMs;
  const skew = first - line.timeMs;
  const looksAbsolute = skew >= -100 && skew <= 3_600_000;
  if (looksAbsolute) {
    return { words: line.words, wordTimed: true };
  }
  const words = line.words.map((word) => ({
    ...word,
    startMs: line.timeMs + Math.max(0, word.startMs - first),
  }));
  return { words, wordTimed: true };
}

function estimateWindowEnd(line: LyricLine, next: LyricLine | undefined): number {
  const estimate =
    line.timeMs +
    Math.min(
      ESTIMATE_MAX_MS,
      Math.max(ESTIMATE_MIN_MS, line.text.length * ESTIMATE_MS_PER_CHAR),
    );
  if (!next || next.timeMs <= line.timeMs + MIN_LINE_WINDOW_MS) return estimate;
  return Math.max(
    line.timeMs + MIN_LINE_WINDOW_MS,
    Math.min(estimate, next.timeMs - NEXT_LINE_MARGIN_MS),
  );
}

function spreadWords(line: LyricLine, windowEnd: number): LyricWord[] {
  const tokens = line.text.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return [{ text: tokens[0] ?? line.text, startMs: line.timeMs }];
  }

  const weights = tokens.map((token) => Math.max(1, token.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const span = windowEnd - line.timeMs;

  let cumulative = 0;
  return tokens.map((token, index) => {
    const startMs = line.timeMs + Math.round((cumulative / total) * span);
    cumulative += weights[index];
    return { text: token, startMs };
  });
}

/** Index of the word that is (or was last) being sung at `elapsedMs`, else -1. */
export function findWordIndex(words: LyricWord[], elapsedMs: number): number {
  let low = 0;
  let high = words.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (words[mid].startMs <= elapsedMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** Index of the line that is (or was last) being sung at `elapsedMs`, else -1. */
export function findLineIndex(lines: LyricLine[], elapsedMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= elapsedMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
