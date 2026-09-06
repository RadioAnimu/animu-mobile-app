import AsyncStorage from "@react-native-async-storage/async-storage";
import { LrcLibClient } from "../../api/lrclib";
import { CONFIG } from "../../utils/player.config";
import { LyricsService } from "./lyrics-service";
import { fetch as expoFetch } from "expo/fetch";

// ─── Lyrics module barrel ───
//
// The lyrics provider is external (LRCLIB), so its client lives next to
// the app's other API integrations; the service owns the matching,
// caching and store emissions. The singleton wiring sits here — tests
// import the class directly with fakes instead of this file.

export { lyricsStore, LYRICS_INITIAL_SNAPSHOT } from "./lyrics-store";
export { LyricsService } from "./lyrics-service";
export type { LyricsStorage } from "./lyrics-service";
export type {
  CachedLyrics,
  LyricsSnapshot,
  LyricsStatus,
  LyricsLanguage,
  LyricCandidate,
  LyricLine,
  LyricWord,
  MatchedMeta,
} from "./types";

export const lrclibClient = new LrcLibClient({
  fetchImpl: expoFetch,
  userAgent: `${CONFIG.USER_AGENT} (lyrics; +https://github.com/nessjs/animu)`,
});

export const lyricsService = new LyricsService({
  api: lrclibClient,
  storage: AsyncStorage,
});
