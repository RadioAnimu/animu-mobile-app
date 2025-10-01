import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Track, getTrackProgress } from "../../core/domain/track";
import { Stream } from "../../core/domain/stream";
import { Listeners } from "../../core/domain/listeners";
import { Program } from "../../core/domain/program";
import { playerService } from "../../core/services/player.service";
import { setPlayerServiceReference } from "../../core/services/player-playback.service";
import { Platform } from "react-native";

type PlayerContextType = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  updateCurrentTrackProgress: () => Promise<void>;
  refreshData: () => Promise<void>;
  currentTrack?: Track;
  lastPlayedTracks?: Track[];
  lastRequestedTracks?: Track[];
  currentProgram?: Program;
  currentStream?: Stream;
  currentListeners?: Listeners;
  currentTrackProgress?: number | null;
  isPlaying: boolean;
  isInitialized: boolean;
};

const PlayerContext = createContext<PlayerContextType>({
  play: () => Promise.reject("Player not initialized"),
  pause: () => Promise.reject("Player not initialized"),
  changeStream: () => Promise.reject("Player not initialized"),
  updateCurrentTrackProgress: () => Promise.reject("Player not initialized"),
  refreshData: () => Promise.reject("Player not initialized"),
  isPlaying: false,
  currentTrackProgress: null,
  isInitialized: false,
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<{
    track?: Track;
    lastPlayedTracks?: Track[];
    lastRequestedTracks?: Track[];
    progress?: number | null;
    program?: Program;
    stream?: Stream;
    listeners?: Listeners;
    isPlaying: boolean;
    isInitialized: boolean;
  }>({ isPlaying: false, isInitialized: false });

  const playerServiceInstance = useMemo(() => playerService(), []);

  useEffect(() => {
    const initializePlayer = async () => {
      console.log("[PlayerProvider] Initializing playerServiceInstance...");

      try {
        // Set the reference for the background service (Android only)
        if (Platform.OS === "android") {
          setPlayerServiceReference(playerServiceInstance);
        }

        setState((prev) => ({
          ...prev,
          stream: playerServiceInstance._currentStream,
          isInitialized: true,
        }));

        console.log("[PlayerProvider] Player initialized successfully.");
      } catch (error) {
        console.error("[PlayerProvider] Player initialization failed:", error);
        setState((prev) => ({
          ...prev,
          isInitialized: false,
        }));
      }
    };

    // Initialize immediately but allow React to finish rendering first
    const timer = setTimeout(initializePlayer, 0);

    return () => {
      clearTimeout(timer);
      console.log("[PlayerProvider] Cleaning up playerServiceInstance...");

      // Cleanup with a delay to prevent crashes
      setTimeout(() => {
        if (playerServiceInstance) {
          playerServiceInstance.destroy().catch(console.error);
        }
      }, 1000);
    };
  }, [playerServiceInstance]);

  const play = async () => {
    console.log("[PlayerProvider] Play requested.");
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
        progress: getTrackProgress(
          playerServiceInstance._currentTrack || undefined
        ),
      }));
    } catch (error) {
      console.error("[PlayerProvider] Play error:", error);
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const pause = async () => {
    console.log("[PlayerProvider] Pause requested.");
    try {
      await playerServiceInstance.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } catch (error) {
      console.error("[PlayerProvider] Pause error:", error);
    }
  };

  const changeStream = async (stream: Stream) => {
    console.log("[PlayerProvider] Stream change requested.");
    try {
      await playerServiceInstance.changeStream(stream);
      setState((prev) => ({
        ...prev,
        stream,
      }));
    } catch (error) {
      console.error("[PlayerProvider] Stream change error:", error);
    }
  };

  const updateCurrentTrackProgress = async () => {
    try {
      setState((prev) => ({
        ...prev,
        progress: getTrackProgress(
          playerServiceInstance._currentTrack || undefined
        ),
      }));
    } catch (error) {
      console.error("[PlayerProvider] Progress update error:", error);
    }
  };

  const refreshData = async () => {
    try {
      console.log("[PlayerProvider] Refreshing player data...");
      console.log(
        "Metadata before refresh:",
        playerServiceInstance.getNowPlayingMetadata()
      );

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
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        play,
        pause,
        changeStream,
        updateCurrentTrackProgress,
        refreshData,
        currentTrack: state.track,
        currentTrackProgress: state.progress,
        lastPlayedTracks: state.lastPlayedTracks,
        lastRequestedTracks: state.lastRequestedTracks,
        currentProgram: state.program,
        currentStream: state.stream,
        currentListeners: state.listeners,
        isPlaying: state.isPlaying,
        isInitialized: state.isInitialized,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
