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

/** FNV-1a, 32 bit: a file name for a song key (the key is stored inside). */
export function fileNameOf(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
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
