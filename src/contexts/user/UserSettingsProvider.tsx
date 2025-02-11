import React, { createContext, useContext, useEffect, useState } from "react";
import { UserSettings } from "../../@types/user-settings";
import { userSettingsService } from "../../core/services/user-settings.service";
import { DEFAULT_USER_SETTINGS } from "../../constants/settings";

type UserSettingsContextType = {
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
};

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: DEFAULT_USER_SETTINGS,
  updateSettings: () => Promise.reject("Settings not initialized"),
  resetSettings: () => Promise.reject("Settings not initialized"),
});

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    const initializeSettings = async () => {
      const initialSettings = await userSettingsService.initialize();
      setSettings(initialSettings);
    };

    initializeSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    await userSettingsService.updateSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  const resetSettings = async () => {
    await userSettingsService.updateSettings(DEFAULT_USER_SETTINGS);
    setSettings(DEFAULT_USER_SETTINGS);
  };

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => useContext(UserSettingsContext);
