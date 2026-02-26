import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { Track, getTrackProgress } from "../../core/domain/track";
import { Stream } from "../../core/domain/stream";
import { Listeners } from "../../core/domain/listeners";
import { Program } from "../../core/domain/program";
import { playerService } from "../../core/services/player.service";
import {
  setPlayerStateUpdater,
  setRemotePlaybackHandlers,
} from "../../core/services/player-playback.service";
import { backgroundService } from "../../core/services/background.service";

const BACKGROUND_REFRESH_INTERVAL = 5000; // 5 seconds
const TRACK_PROGRESS_INTERVAL = 1000; // 1 second

// ─── Separate context for track progress (changes every 1s) ───
type ProgressContextType = {
  currentTrackProgress: number | null;
  showProgress: boolean;
};

const ProgressContext = createContext<ProgressContextType>({
  currentTrackProgress: null,
  showProgress: false,
});

// ─── Main player context (changes only on real data updates) ───
type PlayerContextType = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  refreshData: () => Promise<void>;
  currentTrack?: Track;
  lastPlayedTracks?: Track[];
  lastRequestedTracks?: Track[];
  currentProgram?: Program;
  currentStream?: Stream;
  currentListeners?: Listeners;
  isPlaying: boolean;
  isInitialized: boolean;
};

const PlayerContext = createContext<PlayerContextType>({
  play: () => Promise.reject("Player not initialized"),
  pause: () => Promise.reject("Player not initialized"),
  changeStream: () => Promise.reject("Player not initialized"),
  refreshData: () => Promise.reject("Player not initialized"),
  isPlaying: false,
  isInitialized: false,
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<{
    track?: Track;
    lastPlayedTracks?: Track[];
    lastRequestedTracks?: Track[];
    program?: Program;
    stream?: Stream;
    listeners?: Listeners;
    isPlaying: boolean;
    isInitialized: boolean;
  }>({ isPlaying: false, isInitialized: false });

  const [progress, setProgress] = useState<number | null>(null);

  const playerServiceInstance = useMemo(() => playerService(), []);
  const isRefreshing = useRef(false);

  // Callback to update playing state from background service
  const updatePlayingState = useCallback((isPlaying: boolean) => {
    setState((prev) => {
      if (prev.isPlaying === isPlaying) return prev;
      return { ...prev, isPlaying };
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;

    try {
      const hasChanges = await playerServiceInstance.refreshData();
      if (!hasChanges) return;

      setState((prev) => ({
        ...prev,
        track: playerServiceInstance._currentTrack || undefined,
        lastPlayedTracks: playerServiceInstance._lastPlayedTracks || undefined,
        lastRequestedTracks:
          playerServiceInstance._lastRequestedTracks || undefined,
        program: playerServiceInstance._currentProgram || undefined,
        listeners: playerServiceInstance._listeners || undefined,
      }));
    } catch (error) {
      console.error("[PlayerProvider] Error refreshing data:", error);
    } finally {
      isRefreshing.current = false;
    }
  }, [playerServiceInstance]);

  const updateCurrentTrackProgress = useCallback(async () => {
    const newProgress = getTrackProgress(
      playerServiceInstance._currentTrack || undefined,
    );
    setProgress((prev) => {
      // Only update if the value actually changed (rounded to seconds)
      const prevSec = prev != null ? Math.floor(prev / 1000) : null;
      const newSec =
        newProgress != null ? Math.floor(newProgress / 1000) : null;
      if (prevSec === newSec) return prev;
      return newProgress;
    });

    // Also update the system media session progress bar (lock screen / notification)
    await playerServiceInstance.updateNowPlayingProgress();
  }, [playerServiceInstance]);

  useEffect(() => {
    const initializePlayer = async () => {
      console.log("[PlayerProvider] Initializing playerServiceInstance...");

      try {
        setPlayerStateUpdater(updatePlayingState);

        // Wire up lock screen / notification play/pause to use the full
        // playerService flow (reset → fresh stream → play) instead of
        // just resuming a stale buffered stream.
        setRemotePlaybackHandlers({
          play: async () => {
            await playerServiceInstance.play();
            updatePlayingState(true);
          },
          pause: async () => {
            await playerServiceInstance.pause();
            updatePlayingState(false);
          },
        });

        setState((prev) => ({
          ...prev,
          stream: playerServiceInstance._currentStream,
          isInitialized: true,
        }));

        console.log("[PlayerProvider] Player initialized successfully.");

        // Pre-initialize TrackPlayer ASAP (in parallel with first data fetch)
        // so the system media session is ready before the user presses play.
        const [, preloadResult] = await Promise.allSettled([
          refreshData(),
          playerServiceInstance.preload(),
        ]);

        if (preloadResult.status === "rejected") {
          console.warn(
            "[PlayerProvider] Preload failed:",
            preloadResult.reason,
          );
        }

        updateCurrentTrackProgress();

        // Start background refresh task
        backgroundService.startTask({
          id: "refresh-data",
          callback: refreshData,
          interval: BACKGROUND_REFRESH_INTERVAL,
        });

        // Start track progress update task
        backgroundService.startTask({
          id: "track-progress",
          callback: updateCurrentTrackProgress,
          interval: TRACK_PROGRESS_INTERVAL,
        });

        console.log("[PlayerProvider] Background tasks started.");
      } catch (error) {
        console.error("[PlayerProvider] Player initialization failed:", error);
        setState((prev) => ({
          ...prev,
          isInitialized: false,
        }));
      }
    };

    const timer = setTimeout(initializePlayer, 0);

    return () => {
      clearTimeout(timer);

      backgroundService.stopTask("refresh-data");
      backgroundService.stopTask("track-progress");
      setPlayerStateUpdater(() => {});
      setRemotePlaybackHandlers({
        play: async () => {},
        pause: async () => {},
      });

      setTimeout(() => {
        if (playerServiceInstance) {
          playerServiceInstance.destroy().catch(console.error);
        }
      }, 1000);
    };
  }, [
    playerServiceInstance,
    updatePlayingState,
    refreshData,
    updateCurrentTrackProgress,
  ]);

  const play = useCallback(async () => {
    try {
      await playerServiceInstance.play();
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        track: playerServiceInstance._currentTrack || undefined,
        lastPlayedTracks: playerServiceInstance._lastPlayedTracks || undefined,
        lastRequestedTracks:
          playerServiceInstance._lastRequestedTracks || undefined,
        program: playerServiceInstance._currentProgram || undefined,
        stream: playerServiceInstance._currentStream,
        listeners: playerServiceInstance._listeners || undefined,
      }));
      setProgress(
        getTrackProgress(playerServiceInstance._currentTrack || undefined),
      );
    } catch (error) {
      console.error("[PlayerProvider] Play error:", error);
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, [playerServiceInstance]);

  const pause = useCallback(async () => {
    try {
      await playerServiceInstance.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } catch (error) {
      console.error("[PlayerProvider] Pause error:", error);
    }
  }, [playerServiceInstance]);

  const changeStream = useCallback(
    async (stream: Stream) => {
      try {
        await playerServiceInstance.changeStream(stream);
        setState((prev) => ({ ...prev, stream }));
      } catch (error) {
        console.error("[PlayerProvider] Stream change error:", error);
      }
    },
    [playerServiceInstance],
  );

  // Memoize context values to prevent unnecessary re-renders
  const playerContextValue = useMemo<PlayerContextType>(
    () => ({
      play,
      pause,
      changeStream,
      refreshData,
      currentTrack: state.track,
      lastPlayedTracks: state.lastPlayedTracks,
      lastRequestedTracks: state.lastRequestedTracks,
      currentProgram: state.program,
      currentStream: state.stream,
      currentListeners: state.listeners,
      isPlaying: state.isPlaying,
      isInitialized: state.isInitialized,
    }),
    [play, pause, changeStream, refreshData, state],
  );

  const progressContextValue = useMemo<ProgressContextType>(
    () => ({
      currentTrackProgress: progress,
      showProgress: playerServiceInstance._showMediaProgress,
    }),
    [progress, playerServiceInstance],
  );

  return (
    <PlayerContext.Provider value={playerContextValue}>
      <ProgressContext.Provider value={progressContextValue}>
        {children}
      </ProgressContext.Provider>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
export const useTrackProgress = () => useContext(ProgressContext);
