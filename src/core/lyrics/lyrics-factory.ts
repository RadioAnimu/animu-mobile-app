import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";
import { API } from "@/api";
import { LrcLibClient } from "@/api/lrclib";
import { APP_VERSION } from "@/utils/app-version";
import { japaneseReader } from "@/core/japanese";
import { LyricsFileCache } from "@/core/lyrics/file-cache";
import { LyricsService } from "@/core/lyrics/lyrics-service";
import { lyricsStore } from "@/core/lyrics/store";
import { kanaRomanizer } from "@/core/lyrics/text";

/** LRCLIB asks clients to name themselves; nothing about the device. */
const USER_AGENT = `Animu/${APP_VERSION ?? "dev"} (+${API.GITHUB_URL})`;

let instance: LyricsService | null = null;

/** App-wide lyrics service (composition root). */
export const lyricsService = (): LyricsService => {
  instance ??= new LyricsService({
    provider: new LrcLibClient({ fetch: expoFetch, userAgent: USER_AGENT, browser: Platform.OS === "web" }),
    cache: new LyricsFileCache(),
    store: lyricsStore,
    // Titles in kanji compare against the station's romaji once the offline
    // dictionary is loaded (新時代 ↔ Shin Jidai).
    romanizer: () => japaneseReader.romanizer() ?? kanaRomanizer,
  });
  return instance;
};
