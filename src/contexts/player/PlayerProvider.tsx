import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stream } from "../../core/domain/stream";
import { playerService } from "../../core/player";
import { setRemotePlaybackHandlers } from "../../core/services/player-playback.service";
import { backgroundService } from "../../core/services/background.service";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
} from "../../core/player";
import { Loading } from "../../screens/Loading";

const REFRESH_INTERVAL_PLAYING = 5_000; // 5s safety net (track-end timer handles transitions)
const REFRESH_INTERVAL_PAUSED = 30_000; // 30s when paused (battery friendly)
const TRACK_PROGRESS_INTERVAL = 1000; // 1s (only ticks when track)

// ─── Contexts by change cadence — subscribe to the one you need ───
//
// - usePlayer()        → now-playing data + actions (per song / action)
// - useStation()       → listeners + histories (per API poll)
// - useTrackProgress() → progress (every 1s)
//
// A component reading from only one context never re-renders for the
// others' updates.

type PlayerContextType = PlayerSnapshot & {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  refreshData: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextType>({
  play: () => Promise.reject("Player not initialized"),
  pause: () => Promise.reject("Player not initialized"),
  changeStream: () => Promise.reject("Player not initialized"),
  refreshData: () => Promise.reject("Player not initialized"),
  isPlaying: false,
  isInitialized: false,
});

const StationContext = createContext<StationSnapshot>({});

const ProgressContext = createContext<ProgressSnapshot>({
  currentTrackProgress: null,
  showProgress: false,
});

export const PlayerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // Singleton service — plain call, no memoization (the compiler treats
  // memoized objects as frozen, and the player is inherently mutable)
  const playerServiceInstance = playerService();

  // ─── Subscribe to stores — the service is the single source of truth ───
  const playerSnapshot = useSyncExternalStore(
    playerStore.subscribe,
    playerStore.getSnapshot,
  );

  const stationSnapshot = useSyncExternalStore(
    stationStore.subscribe,
    stationStore.getSnapshot,
  );

  const progressSnapshot = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );

  // ─── App visibility — gates the poll lifecycle (see the effect below) ───
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  // ─── Initialization & background tasks ───
  useEffect(() => {
    let cancelled = false;

    const initializePlayer = async () => {
      try {
        setRemotePlaybackHandlers({
          play: async () => {
            await playerServiceInstance.play();
          },
          pause: async () => {
            await playerServiceInstance.pause();
          },
          toggle: async () => {
            if (playerServiceInstance.isPlayingIntent) {
              await playerServiceInstance.pause();
            } else {
              await playerServiceInstance.play();
            }
          },
          stop: async () => {
            await playerServiceInstance.pause();
          },
        });

        if (cancelled) return;

        // Single call: streams + stored pref + native setup + settings + data fetch
        await playerServiceInstance.setupPlayer();
      } catch (error) {
        console.error("[PlayerProvider] Player initialization failed:", error);
        // The service never flipped its initialized flag, so the store
        // still reflects the uninitialized state — nothing to re-emit.
      }
    };

    initializePlayer();

    // ── Foreground refresh: fresh data the moment the app is visible ──
    // JS timers freeze while backgrounded (iOS) or drift while the OS
    // throttles them (Android Doze), so the last poll can be minutes old.
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        setAppState(nextAppState);
        if (nextAppState === "active" && playerServiceInstance.isReady) {
          void playerServiceInstance.refreshData().catch(console.error);
        }
      },
    );

    return () => {
      cancelled = true;

      appStateSubscription?.remove();
      backgroundService.stopTask("refresh-data");
      backgroundService.stopTask("track-progress");
      setRemotePlaybackHandlers({
        play: async () => {},
        pause: async () => {},
        toggle: async () => {},
        stop: async () => {},
      });

      playerServiceInstance.destroy().catch(console.error);
    };
  }, [playerServiceInstance]);

  // ─── Poll lifecycle: while visible or playing, otherwise suspended ───
  //
  // - Playing (foreground or background): 5s — powers the live badge AND
  //   keeps the notification's metadata/seek bar fresh on track changes.
  // - Paused + foreground: 30s — badge/history stay fresh for a user with
  //   the app open but paused.
  // - Paused + background: suspended — nothing visible can change, so
  //   polling would be pure battery/radio-data waste.
  useEffect(() => {
    if (!playerSnapshot.isInitialized) return;

    const shouldPoll = playerSnapshot.isPlaying || appState === "active";

    if (!shouldPoll) {
      backgroundService.stopTask("refresh-data");
      backgroundService.stopTask("track-progress");
      return;
    }

    // startTask restarts cleanly by id — safe on every effect re-run
    backgroundService.startTask({
      id: "refresh-data",
      callback: async () => {
        await playerServiceInstance.refreshData();
      },
      interval: playerSnapshot.isPlaying
        ? REFRESH_INTERVAL_PLAYING
        : REFRESH_INTERVAL_PAUSED,
    });

    // Progress tick (the ticker itself early-returns without a track)
    backgroundService.startTask({
      id: "track-progress",
      callback: async () => {
        playerServiceInstance.tickProgress();
      },
      interval: TRACK_PROGRESS_INTERVAL,
    });
  }, [
    playerSnapshot.isPlaying,
    playerSnapshot.isInitialized,
    appState,
    playerServiceInstance,
  ]);
  // ─── Action wrappers — delegate to the service (which auto-emits) ───

  const play = useCallback(async () => {
    try {
      await playerServiceInstance.play();
    } catch (error) {
      console.error("[PlayerProvider] Play error:", error);
    }
  }, [playerServiceInstance]);

  const pause = useCallback(async () => {
    try {
      await playerServiceInstance.pause();
    } catch (error) {
      console.error("[PlayerProvider] Pause error:", error);
    }
  }, [playerServiceInstance]);

  const changeStream = useCallback(
    async (stream: Stream) => {
      try {
        await playerServiceInstance.changeStream(stream);
      } catch (error) {
        console.error("[PlayerProvider] Stream change error:", error);
      }
    },
    [playerServiceInstance],
  );

  const refreshData = useCallback(async () => {
    try {
      await playerServiceInstance.refreshData();
    } catch (error) {
      console.error("[PlayerProvider] Error refreshing data:", error);
    }
  }, [playerServiceInstance]);

  // ─── Context values ───

  const playerContextValue = useMemo<PlayerContextType>(
    () => ({
      ...playerSnapshot,
      play,
      pause,
      changeStream,
      refreshData,
    }),
    [playerSnapshot, play, pause, changeStream, refreshData],
  );

  return (
    <PlayerContext.Provider value={playerContextValue}>
      <StationContext.Provider value={stationSnapshot}>
        <ProgressContext.Provider value={progressSnapshot}>
          {playerSnapshot.isInitialized ? children : <Loading />}
        </ProgressContext.Provider>
      </StationContext.Provider>
    </PlayerContext.Provider>
  );
};

/** Now-playing data + playback actions (per song / program / action). */
export const usePlayer = () => useContext(PlayerContext);

/** Poll data — current listeners and the request/played histories. */
export const useStation = () => useContext(StationContext);

/** Track progress (every 1s while a track plays). */
export const useTrackProgress = () => useContext(ProgressContext);
