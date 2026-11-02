import { UserSettings } from "@/@types/user-settings";
import { MB } from "@/utils/format";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  // `medium` (~60KB) instead of `high`: `_large` covers can hit multi-MB,
  // and on the occasionally stalled link those were the difference
  // between art in 1s and art in 20s+ (users can still pick High).
  liveQualityCover: "medium",
  lastRequestedCovers: true,
  lastPlayedCovers: true,
  coversInRequestSearch: true,
  selectedLanguage: "PT",
  cacheEnabled: true,
  // Capped by default: uncapped, the image cache kept every cover heard
  // (Android stops only at Glide's 250 MB, iOS at a week's age).
  coverCacheLimitBytes: 100 * MB,
  coverCachePartitionBytes: null,
  visualizerHz: 60,
  hapticsEnabled: true,
  lyricsPronunciation: "romaji",
  settingsVersion: 2,
};
