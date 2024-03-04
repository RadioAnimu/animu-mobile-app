import { LANGS_KEY_VALUE_PAIRS } from "./../languages/index";

export interface UserSettings {
  liveQualityCover: "high" | "medium" | "low" | "off";
  lastRequestedCovers: boolean;
  lastPlayedCovers: boolean;
  coversInRequestSearch: boolean;
  selectedLanguage: keyof typeof LANGS_KEY_VALUE_PAIRS;
  cacheEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  liveQualityCover: "high",
  lastRequestedCovers: true,
  lastPlayedCovers: true,
  coversInRequestSearch: true,
  selectedLanguage: "PT",
  cacheEnabled: true,
};

import { Context, createContext } from "react";

export interface UserSettingsContextProps {
  userSettings: UserSettings;
  setUserSettings: (userSettings: UserSettings) => void;
}

export const UserSettingsContext: Context<UserSettingsContextProps> =
  createContext<UserSettingsContextProps>({
    userSettings: DEFAULT_USER_SETTINGS,
    setUserSettings: () => {},
  });
