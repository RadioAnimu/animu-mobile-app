import type { LyricsCandidate } from "@/core/lyrics/types";

/** The lyrics database (LRCLIB in the app, a fake in tests). */
export interface LyricsProvider {
  /** Exact title + artist (+ duration) lookup; `null` when there is none. */
  get(params: { trackName: string; artistName: string; durationSec?: number }): Promise<LyricsCandidate | null>;
  search(params: { trackName?: string; artistName?: string; q?: string }): Promise<LyricsCandidate[]>;
}

/** A lookup's outcome, as cached: the accepted row, or a known miss. */
export type LookupResult =
  | { kind: "match"; candidate: LyricsCandidate; timed: boolean }
  | { kind: "none" };

export interface CachedLookup {
  savedAt: number;
  result: LookupResult;
}

/** Persistent lookup cache (files in the app's cache directory). */
export interface LyricsCache {
  read(key: string): Promise<CachedLookup | null>;
  write(key: string, entry: CachedLookup): Promise<void>;
  /** Bytes on disk (Storage screen). */
  size(): Promise<number>;
  clear(): Promise<void>;
}
