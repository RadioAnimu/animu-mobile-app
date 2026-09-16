import { UserSettings } from "../@types/user-settings";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  liveQualityCover: "high",
  lastRequestedCovers: true,
  lastPlayedCovers: true,
  coversInRequestSearch: true,
  selectedLanguage: "PT",
  cacheEnabled: true,
  coverCacheLimitBytes: 0,
  coverCachePartitionBytes: null,
  visualizerHz: 60,
  liveUpdatesInBackground: true,
};
