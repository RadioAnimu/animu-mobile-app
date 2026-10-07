import { toHiragana } from "wanakana";
import { buildTimeline, parseLrc } from "@/core/lyrics/lrc";
import { inJapaneseScript, isTimedFor, scoreCandidate, type ScoredCandidate } from "@/core/lyrics/matcher";
import type { Romanizer } from "@/core/lyrics/text";
import type { LyricEntry, LyricsCandidate, TrackQuery } from "@/core/lyrics/types";

// ─── Romaji from a sibling upload ───
//
// LRCLIB often carries the same song twice: in Japanese and in romaji, both
// timed. Lines that start together are the same line, so the romaji upload
// labels the Japanese one with human readings — no dictionary needed. A
// sibling must line up with most lines and actually spell their kana: a
// translation (English, Spanish…) or another arrangement does not.

/** Lines further apart than this are not the same line (ms). */
const PAIR_WINDOW_MS = 1_000;
/** Share of Japanese lines that must find a partner. */
const MIN_PAIRED = 0.6;
/** Share of a line's kana its partner must spell, on average. */
const MIN_SPELLED = 0.55;
/** A sibling's cut may differ from the original's by this much (ms). */
const SIBLING_DURATION_MS = 2_500;

const KANA = /[ぁ-ゖァ-ヺ]/g;
const JAPANESE = /[ぁ-ヿ㐀-䶿一-鿿]/;

/** How much of `kana` appears, in order, in `reading` (0..1). */
function spelled(kana: string, reading: string): number {
  if (!kana) return 1;
  let found = 0;
  let from = 0;
  for (const char of kana) {
    const at = reading.indexOf(char, from);
    if (at >= 0) {
      found += 1;
      from = at + 1;
    }
  }
  return found / kana.length;
}

/**
 * Romaji for each entry from a sibling upload (`""` where none: interludes,
 * English lines, unmatched lines), or `null` when the sibling is not a romaji
 * transcription of these lines.
 */
export function pairRomaji(entries: readonly LyricEntry[], romajiLrc: string): string[] | null {
  const rows = parseLrc(romajiLrc).filter((row) => row.text);
  if (rows.length === 0) return null;

  let japanese = 0;
  let paired = 0;
  let spelling = 0;
  const labels = entries.map((entry) => {
    if (entry.kind !== "line" || !JAPANESE.test(entry.text)) return "";
    japanese += 1;
    let partner: (typeof rows)[number] | null = null;
    for (const row of rows) {
      const distance = Math.abs(row.startMs - entry.startMs);
      if (distance <= PAIR_WINDOW_MS && (!partner || distance < Math.abs(partner.startMs - entry.startMs))) {
        partner = row;
      }
    }
    if (!partner || JAPANESE.test(partner.text)) return "";
    paired += 1;
    // Particles are written as said (は → wa): small misses are expected.
    const kana = toHiragana(entry.text.match(KANA)?.join("") ?? "");
    spelling += spelled(kana, toHiragana(partner.text.toLowerCase()));
    return partner.text;
  });

  if (japanese === 0 || paired / japanese < MIN_PAIRED || spelling / paired < MIN_SPELLED) return null;
  return labels;
}

/**
 * A romaji upload of `original` among the rows found: the same song (it
 * passes the matcher), timed for the same cut, in Latin script, and pairing
 * with the original's lines. Closest duration first.
 */
export function findRomajiSibling(
  track: TrackQuery,
  original: ScoredCandidate,
  rows: readonly LyricsCandidate[],
  romanize?: Romanizer,
): LyricsCandidate | null {
  const synced = original.candidate.syncedLyrics;
  if (!synced) return null;
  const originalMs = (original.candidate.durationSec ?? 0) * 1000;
  const siblings = rows
    .filter((row) => row.id !== original.candidate.id && row.syncedLyrics && !inJapaneseScript(row))
    .map((row) => scoreCandidate(track, row, romanize))
    .filter((scored) => scored.identity > 0 && isTimedFor(scored))
    .map((scored) => ({ row: scored.candidate, gap: Math.abs((scored.candidate.durationSec ?? 0) * 1000 - originalMs) }))
    .filter(({ gap }) => originalMs === 0 || gap <= SIBLING_DURATION_MS)
    .sort((a, b) => a.gap - b.gap);
  if (siblings.length === 0) return null;
  const entries = buildTimeline(parseLrc(synced));
  return siblings.find(({ row }) => pairRomaji(entries, row.syncedLyrics ?? "") != null)?.row ?? null;
}
