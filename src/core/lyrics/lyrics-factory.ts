import { fetch as expoFetch } from "expo/fetch";
import * as Application from "expo-application";
import { API } from "@/api";
import { LrcLibClient } from "@/api/lrclib";
import { japaneseReader } from "@/core/japanese";
import { LyricsFileCache } from "@/core/lyrics/file-cache";
import { LyricsService } from "@/core/lyrics/lyrics-service";
import { lyricsStore } from "@/core/lyrics/store";
import { kanaRomanizer } from "@/core/lyrics/text";

/** LRCLIB asks clients to name themselves; nothing about the device. */
const USER_AGENT = `Animu/${Application.nativeApplicationVersion ?? "dev"} (+${API.GITHUB_URL})`;

let instance: LyricsService | null = null;

/** App-wide lyrics service (composition root). */
export const lyricsService = (): LyricsService => {
  instance ??= new LyricsService({
    provider: new LrcLibClient({ fetch: expoFetch, userAgent: USER_AGENT }),
    cache: new LyricsFileCache(),
    store: lyricsStore,
    // Titles in kanji compare against the station's romaji once the offline
    // dictionary is loaded (新時代 ↔ Shin Jidai).
    romanizer: () => japaneseReader.romanizer() ?? kanaRomanizer,
  });
  return instance;
};
