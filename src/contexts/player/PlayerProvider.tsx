import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { Stream } from "../../core/domain/stream";
import { playerService } from "../../core/services/player.service";
import {
  setPlayerStateUpdater,
  setRemotePlaybackHandlers,
} from "../../core/services/player-playback.service";
import { backgroundService } from "../../core/services/background.service";
import {
  playerStore,
  progressStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
} from "../../core/services/player-store";
import { Loading } from "../../screens/Loading";

const REFRESH_INTERVAL_PLAYING = 20_000; // 20s safety net (track-end timer handles transitions)
const REFRESH_INTERVAL_PAUSED = 30_000; // 30s when paused (battery friendly)
const TRACK_PROGRESS_INTERVAL = 1000; // 1s (only ticks when track)

// ─── Separate context for track progress (changes every 1s) ───
const ProgressContext = createContext<ProgressSnapshot>({
  currentTrackProgress: null,
  showProgress: false,
});

// ─── Main player context (changes only on real data updates) ───
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

export const PlayerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const playerServiceInstance = useMemo(() => playerService(), []);

  // ─── Subscribe to stores — the service is the single source of truth ───
  const snapshot = useSyncExternalStore(
    playerStore.subscribe,
    playerStore.getSnapshot,
  );

  const progressSnapshot = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );

  // ─── Initialization & background tasks ───
  useEffect(() => {
    let cancelled = false;

    const initializePlayer = async () => {
      console.log("[PlayerProvider] Initializing playerServiceInstance...");

      try {
        // Bridge lock-screen / notification events back to the service.
        setPlayerStateUpdater((isPlaying: boolean) => {
          playerServiceInstance._paused = !isPlaying;
          playerServiceInstance._emitState();
        });

        setRemotePlaybackHandlers({
          play: async () => {
            await playerServiceInstance.play();
          },
          pause: async () => {
            await playerServiceInstance.pause();
          },
        });

        if (cancelled) return;

        // Single call: streams + stored pref + native setup + settings + data fetch
        await playerServiceInstance.setupPlayer();

        if (cancelled) return;

        // Adaptive refresh — polls faster when playing, slower when paused
        backgroundService.startTask({
          id: "refresh-data",
          callback: async () => {
            await playerServiceInstance.refreshData();
          },
          interval: playerServiceInstance._paused
            ? REFRESH_INTERVAL_PAUSED
            : REFRESH_INTERVAL_PLAYING,
        });

        // Progress tick (the service itself early-returns when paused)
        backgroundService.startTask({
          id: "track-progress",
          callback: async () => {
            await playerServiceInstance._tickProgress();
          },
          interval: TRACK_PROGRESS_INTERVAL,
        });

        console.log("[PlayerProvider] Background tasks started.");
      } catch (error) {
        console.error("[PlayerProvider] Player initialization failed:", error);
        playerServiceInstance._isInitialized = false;
        playerServiceInstance._emitState();
      }
    };

    initializePlayer();

    return () => {
      cancelled = true;

      backgroundService.stopTask("refresh-data");
      backgroundService.stopTask("track-progress");
      setPlayerStateUpdater(() => {});
      setRemotePlaybackHandlers({
        play: async () => {},
        pause: async () => {},
      });

      playerServiceInstance.destroy().catch(console.error);
    };
  }, [playerServiceInstance]);

  // ─── Adaptive refresh: switch interval on play/pause ───
  useEffect(() => {
    if (!snapshot.isInitialized) return;

    // Restart refresh task with the appropriate interval
    backgroundService.stopTask("refresh-data");
    backgroundService.startTask({
      id: "refresh-data",
      callback: async () => {
        await playerServiceInstance.refreshData();
      },
      interval: snapshot.isPlaying
        ? REFRESH_INTERVAL_PLAYING
        : REFRESH_INTERVAL_PAUSED,
    });
  }, [snapshot.isPlaying, snapshot.isInitialized, playerServiceInstance]);

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
      ...snapshot,
      play,
      pause,
      changeStream,
      refreshData,
    }),
    [snapshot, play, pause, changeStream, refreshData],
  );

  return (
    <PlayerContext.Provider value={playerContextValue}>
      <ProgressContext.Provider value={progressSnapshot}>
        {snapshot.isInitialized ? children : <Loading />}
      </ProgressContext.Provider>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
export const useTrackProgress = () => useContext(ProgressContext);
