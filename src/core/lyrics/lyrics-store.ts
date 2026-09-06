import { createStore } from "../player/store";
import type { LyricsSnapshot } from "./types";

export const LYRICS_INITIAL_SNAPSHOT: LyricsSnapshot = {
  status: "idle",
  trackKey: null,
  lines: [],
  plainText: null,
  language: "unknown",
  matched: null,
  hasMeasuredWords: false,
  updatedAt: 0,
};

export const lyricsStore = createStore<LyricsSnapshot>(LYRICS_INITIAL_SNAPSHOT);
