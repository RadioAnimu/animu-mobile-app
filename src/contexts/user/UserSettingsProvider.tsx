import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserSettings } from "../../@types/user-settings";
import { userSettingsService } from "../../core/services/user-settings.service";
import { coverDiskStorage } from "../../core/services/cover-disk-storage.service";
import { playerService } from "../../core/player";
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
  // Latest snapshot for updates that resolve out of order — spreading the
  // render closure's `settings` would clobber a concurrent change.
  const settingsRef = useRef(settings);

  const applySettings = (next: UserSettings) => {
    settingsRef.current = next;
    setSettings(next);
  };

  // ── Live-station (SSE) wiring ──
  // The realtime surface follows the battery policy: on / off + visibility +
  // play intent. Route the toggle through the service so it rebuilds the
  // connection immediately — not on the next appState transition.
  useEffect(() => {
    playerService().updateLiveStreamLifecycle();
  }, [settings.liveUpdatesInBackground]);

  // ── Visualizer wiring ──
  // Uncapped, like the web player's rAF loop: emitting the trace runs without
  // a rate cap and the visualizer commits each frame at the display's own
  // vsync, self-adapting per device. `0` = off, `> 0` = on.
  useEffect(() => {
    playerService().setVisualizerEnabled(settings.visualizerHz > 0);
  }, [settings.visualizerHz]);

  useEffect(() => {
    const initializeSettings = async () => {
      const initialSettings = await userSettingsService.initialize();
      applySettings(initialSettings);
    };

    initializeSettings();
  }, []);

  /** Serialization chain — interleaved updates (a slow OFF wipe vs a fast
      ON) must persist and apply strictly in call order, or a stale write
      clobbers the newer one and storage/UI disagree. Lazily initialized
      (allocation happens once, not eagerly at every ref decl). */
  const updateChainRef = useRef<Promise<void> | null>(null);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    const previous = settingsRef.current;
    const updatedSettings = { ...previous, ...newSettings };
    // Turning the cache OFF must wipe it, not only stop writing — the user's
    // intent is "nothing kept from now on". The provider is the single
    // choke point every toggle funnels through, so the wipe (image caches +
    // registry) runs BEFORE the handoff: no surface can cache mid-wipe, and
    // covers re-render with policy "none" right after.
    const cacheTurningOff = previous.cacheEnabled && !updatedSettings.cacheEnabled;
    const wipeIfNeeded = async () => {
      if (!cacheTurningOff) return;
      // Non-fatal: a failed wipe must not leave the toggle dead — the
      // "none" policy still stops new writes and the wipe stays retryable
      // via the storage card's clean button until it succeeds.
      await coverDiskStorage.clearAll().catch((error) => {
        console.warn("[UserSettings] cache wipe on disable failed:", error);
      });
    };

    const run = (updateChainRef.current ?? Promise.resolve()).then(async () => {
      await wipeIfNeeded();
      await userSettingsService.updateSettings(updatedSettings);
      applySettings(updatedSettings);
    });
    updateChainRef.current = run.catch((error) => {
      console.error("Settings update chain failed:", error);
    });
    return run;
  }, []);

  const resetSettings = useCallback(async () => {
    // Reset never implies a wipe: the default re-ENABLES caching (true),
    // so the transition path never matches "turning off". Chained like
    // updateSettings so it can't interleave a queued toggle's persist.
    const run = (updateChainRef.current ?? Promise.resolve()).then(async () => {
      await userSettingsService.updateSettings(DEFAULT_USER_SETTINGS);
      applySettings(DEFAULT_USER_SETTINGS);
    });
    updateChainRef.current = run.catch((error) => {
      console.error("Settings reset chain failed:", error);
    });
    return run;
  }, []);

  // Stable identity per settings change — rebuilding the object on every
  // render would re-render every context consumer on any parent update.
  const contextValue = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings],
  );

  return (
    <UserSettingsContext.Provider value={contextValue}>
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => useContext(UserSettingsContext);
