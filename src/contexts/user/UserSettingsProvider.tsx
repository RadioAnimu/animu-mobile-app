import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserSettings } from "@/@types/user-settings";
import { userSettingsService } from "@/core/services/user-settings.service";
import { coverDiskStorage } from "@/core/services/cover-disk-storage.service";
import { playerService } from "@/core/player";
import { DEFAULT_USER_SETTINGS } from "@/constants/settings";

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

  /** Serialization chain — interleaved updates (a slow OFF wipe vs a fast
      ON) must persist and apply strictly in call order, or a stale write
      clobbers the newer one and storage/UI disagree. Lazily initialized
      (allocation happens once, not eagerly at every ref decl). */
  const updateChainRef = useRef<Promise<void> | null>(null);

  // Seeding the chain with initialization is what makes the serialization
  // real: a toggle landing before `initialize()` resolves queues BEHIND the
  // load instead of racing it — otherwise the update would persist defaults
  // + change, then the load's late `applySettings` would clobber the UI while
  // disk kept the change (or vice versa).
  useEffect(() => {
    const run = (async () => {
      const initialSettings = await userSettingsService.initialize();
      applySettings(initialSettings);
    })();
    updateChainRef.current = run.catch((error) => {
      console.error("Settings initialization failed:", error);
    });
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    // Serialize: interleaved updates (a slow OFF wipe vs a fast ON) must
    // persist and apply strictly in call order, or a stale write clobbers
    // the newer one and storage/UI disagree.
    const run = (updateChainRef.current ?? Promise.resolve()).then(async () => {
      // Merge base read at CHAIN time, not call time — everything queued
      // before us already applied, so `settingsRef.current` is the newest
      // agreed state. Capturing before the chain would re-apply stale
      // attribute values and clobber the update queued just before ours.
      const previous = settingsRef.current;
      const updatedSettings = { ...previous, ...newSettings };

      // Turning the cache OFF must wipe it, not only stop writing — the
      // user's intent is "nothing kept from now on". The wipe runs BEFORE
      // the handoff: no surface can cache mid-wipe, and covers re-render
      // with policy "none" right after. Non-fatal: a failed wipe must not
      // leave the toggle dead — the "none" policy still stops new writes
      // and the wipe stays retryable via the storage card's clean button.
      const cacheTurningOff =
        previous.cacheEnabled && !updatedSettings.cacheEnabled;
      if (cacheTurningOff) {
        await coverDiskStorage.clearAll().catch((error) => {
          console.warn("[UserSettings] cache wipe on disable failed:", error);
        });
      }

      // A NEW or LOWERED limit — or a partition customization — trims right
      // away: picking "250 MB" with 800 MB cached must not wait for the
      // next screen focus. A raised limit needs no pass (under budget
      // already). Cache-off turns take the wipe path above instead —
      // trimming into a wipe is meaningless.
      const limitChanged =
        previous.cacheEnabled &&
        updatedSettings.cacheEnabled &&
        (previous.coverCacheLimitBytes !== updatedSettings.coverCacheLimitBytes ||
          previous.coverCachePartitionBytes !==
            updatedSettings.coverCachePartitionBytes);
      if (limitChanged) {
        await coverDiskStorage
          .trim(
            updatedSettings.coverCacheLimitBytes,
            updatedSettings.coverCachePartitionBytes,
          )
          .catch((error) => {
            console.warn("[UserSettings] cache trim on limit change failed:", error);
          });
      }

      // Changing the artwork quality invalidates every cached cover URL:
      // each tier caches under its own URL key, so switching high→low (or
      // any) without a wipe would leave a mix of old-tier files around.
      // Full clearAll — the exact "clear cached covers" path. Non-fatal:
      // the new tier still applies and surfaces re-download what they miss.
      if (previous.liveQualityCover !== updatedSettings.liveQualityCover) {
        await coverDiskStorage.clearAll().catch((error) => {
          console.warn("[UserSettings] cache wipe on quality change failed:", error);
        });
      }

      try {
        await userSettingsService.updateSettings(updatedSettings);
        applySettings(updatedSettings);
      } catch (error) {
        // Persist failed: keep the previous in-memory value so the UI can
        // never diverge from what is actually on disk (a silently-applied
        // toggle that reverts on the next launch is the worse failure).
        console.error(
          "[UserSettings] update not applied — persist failed:",
          error,
        );
      }
    });
    updateChainRef.current = run.catch((error) => {
      console.error("Settings update chain failed:", error);
    });
    return run;
  }, []);

  const resetSettings = useCallback(async () => {
    // Reset never implies a cache-off wipe (the default re-ENABLES caching),
    // but it can change the artwork quality: cached covers key off the tier's
    // URL, so a reset from a non-default quality leaves old-tier files mixed
    // with the new ones — same wipe `updateSettings` runs for that transition.
    // Chained like updateSettings so it can't interleave a queued toggle.
    const run = (updateChainRef.current ?? Promise.resolve()).then(async () => {
      if (
        settingsRef.current.liveQualityCover !==
        DEFAULT_USER_SETTINGS.liveQualityCover
      ) {
        await coverDiskStorage.clearAll().catch((error) => {
          console.warn("[UserSettings] cache wipe on reset failed:", error);
        });
      }
      try {
        await userSettingsService.updateSettings(DEFAULT_USER_SETTINGS);
        applySettings(DEFAULT_USER_SETTINGS);
      } catch (error) {
        console.error("[UserSettings] reset not applied — persist failed:", error);
      }
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
