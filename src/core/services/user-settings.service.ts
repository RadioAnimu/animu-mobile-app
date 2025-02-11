import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSettings } from "../../@types/user-settings";
import { DEFAULT_USER_SETTINGS } from "../../constants/settings";

class UserSettingsService {
  private settings: UserSettings = DEFAULT_USER_SETTINGS;

  async initialize(): Promise<UserSettings> {
    try {
      const stored = await AsyncStorage.getItem("userSettings");
      if (stored) {
        this.settings = JSON.parse(stored);
      }
      return this.settings;
    } catch {
      return DEFAULT_USER_SETTINGS;
    }
  }

  async updateSettings(newSettings: UserSettings): Promise<void> {
    try {
      await AsyncStorage.setItem("userSettings", JSON.stringify(newSettings));
      this.settings = newSettings;
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  getCurrentSettings(): UserSettings {
    return this.settings;
  }
}

export const userSettingsService = new UserSettingsService();
