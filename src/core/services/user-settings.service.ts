import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSettings } from "@/@types/user-settings";
import { DEFAULT_USER_SETTINGS } from "@/constants/settings";
import { LANGUAGE_LABELS } from "@/constants/languages";

class UserSettingsService {
  private settings: UserSettings = DEFAULT_USER_SETTINGS;

  async initialize(): Promise<UserSettings> {
    try {
      const stored = await AsyncStorage.getItem("userSettings");
      if (stored) {
        // Merge over defaults so settings added in later releases are present
        // for users upgrading from an older build (stored JSON lacks them).
        const merged = { ...DEFAULT_USER_SETTINGS, ...JSON.parse(stored) };
        // A removed/renamed language key (or corrupt storage) must never reach
        // `DICT[...]`/`IMGS[...]` — an invalid key there crashes every screen,
        // and the ErrorBoundary can't clear storage. Fall back to the default.
        if (!(merged.selectedLanguage in LANGUAGE_LABELS)) {
          merged.selectedLanguage = DEFAULT_USER_SETTINGS.selectedLanguage;
        }
        this.settings = merged;
      }
      return this.settings;
    } catch {
      // Corrupt/unreadable store: ADOPT the defaults in memory too — this is a
      // singleton, so returning them without assigning would leave a stale
      // value for every later getCurrentSettings() reader this session.
      this.settings = DEFAULT_USER_SETTINGS;
      return this.settings;
    }
  }

  /**
   * Persists and adopts new settings. Throws on a write failure so callers
   * don't apply an in-memory change that silently reverts on next launch
   * (the cache stays on disk, but the UI must not claim it was saved).
   */
  async updateSettings(newSettings: UserSettings): Promise<void> {
    try {
      await AsyncStorage.setItem("userSettings", JSON.stringify(newSettings));
      this.settings = newSettings;
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    }
  }

  getCurrentSettings(): UserSettings {
    return this.settings;
  }
}

export const userSettingsService = new UserSettingsService();