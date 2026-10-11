import { createStore } from "@/core/external-store";
import type { Lyrics } from "@/core/lyrics/types";

/**
 * - `idle`: nothing asked (or not a song: a jingle, a live show);
 * - `loading` → `ready` (`lyrics` set) | `missing` (no lyrics anywhere) |
 *   `error` (the lookup failed; retryable).
 */
export type LyricsStatus = "idle" | "loading" | "ready" | "missing" | "error";

export type LyricsSnapshot = {
  status: LyricsStatus;
  /** The song these lyrics belong to (see `LyricsService.keyOf`). */
  trackKey: string | null;
  lyrics: Lyrics | null;
};

export const LYRICS_IDLE: LyricsSnapshot = { status: "idle", trackKey: null, lyrics: null };

export const lyricsStore = createStore<LyricsSnapshot>(LYRICS_IDLE);
