import { UserSettings } from "@/@types/user-settings";

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
  coverCacheLimitBytes: 0,
  coverCachePartitionBytes: null,
  visualizerHz: 60,
  liveUpdatesInBackground: true,
  hapticsEnabled: true,
};
