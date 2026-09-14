import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UserSettings } from "../../@types/user-settings";
import { userSettingsService } from "../../core/services/user-settings.service";
import { playerService } from "../../core/player";
import { DEFAULT_USER_SETTINGS } from "../../constants/settings";

/** Pushes visualizer-related settings to the player core (single owner). */
const applyVisualizerSettings = (settings: UserSettings) => {
  playerService().setVisualizerHz(settings.visualizerHz);
};

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
  // Latest snapshot for updates that resolve out of order — spreading the
  // render closure's `settings` would clobber a concurrent change.
  const settingsRef = useRef(settings);

  const applySettings = (next: UserSettings) => {
    settingsRef.current = next;
    setSettings(next);
    applyVisualizerSettings(next);
  };

  useEffect(() => {
    const initializeSettings = async () => {
      const initialSettings = await userSettingsService.initialize();
      applySettings(initialSettings);
    };

    initializeSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updatedSettings = { ...settingsRef.current, ...newSettings };
    await userSettingsService.updateSettings(updatedSettings);
    applySettings(updatedSettings);
  };

  const resetSettings = async () => {
    await userSettingsService.updateSettings(DEFAULT_USER_SETTINGS);
    applySettings(DEFAULT_USER_SETTINGS);
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
