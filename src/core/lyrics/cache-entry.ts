import type { CachedLookup } from "@/core/lyrics/ports";

/** Lookups kept on disk; the oldest go first. */
export const MAX_ENTRIES = 400;
/**
 * Trim slack: in steady state the cache already holds MAX_ENTRIES, so
 * trimming on every write would re-list and re-sort it each time. Trim only
 * once the count reaches MAX_ENTRIES + TRIM_SLACK, and then back down to
 * MAX_ENTRIES.
 */
export const TRIM_SLACK = 50;
const FORMAT = 1;

interface StoredLookup extends CachedLookup {
  format: number;
  key: string;
}

/**
 * FNV-1a, 32 bit: a file name for a song key (the key is stored inside).
 * It hashes UTF-16 units, not code points: the names already on disk were made
 * that way, and a different hash would orphan every cached lookup. A code point
 * past U+FFFF is split back into its two surrogates; a lone surrogate comes
 * through the iteration as itself.
 */
export function fileNameOf(key: string): string {
  let hash = 0x811c9dc5;
  const mix = (unit: number) => {
    hash = Math.imul(hash ^ unit, 0x01000193) >>> 0;
  };
  for (const char of key) {
    const point = char.codePointAt(0) ?? 0;
    if (point > 0xffff) {
      mix(0xd800 + ((point - 0x10000) >> 10));
      mix(0xdc00 + ((point - 0x10000) & 0x3ff));
    } else {
      mix(point);
    }
  }
  return `${hash.toString(16).padStart(8, "0")}-${key.length}.json`;
}

export function encodeEntry(key: string, entry: CachedLookup): string {
  const stored: StoredLookup = { format: FORMAT, key, ...entry };
  return JSON.stringify(stored);
}

/** The entry stored for `key`; `null` for another song (a hash collision) or an old format. */
export function decodeEntry(text: string, key: string): CachedLookup | null {
  const stored = JSON.parse(text) as Partial<StoredLookup>;
  if (stored.format !== FORMAT || stored.key !== key) return null;
  if (typeof stored.savedAt !== "number" || !stored.result) return null;
  return { savedAt: stored.savedAt, result: stored.result };
}
