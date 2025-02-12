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

type PlayerContextType = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  updateCurrentTrackProgress: () => Promise<void>;
  refreshData: () => Promise<void>;
  currentTrack?: Track;
  currentProgram?: Program;
  currentStream?: Stream;
  currentListeners?: Listeners;
  currentTrackProgress?: number | null;
  isPlaying: boolean;
};

const PlayerContext = createContext<PlayerContextType>({
  play: () => Promise.reject("Player not initialized"),
  pause: () => Promise.reject("Player not initialized"),
  changeStream: () => Promise.reject("Player not initialized"),
  updateCurrentTrackProgress: () => Promise.reject("Player not initialized"),
  refreshData: () => Promise.reject("Player not initialized"),
  isPlaying: false,
  currentTrackProgress: null,
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<{
    track?: Track;
    progress?: number | null;
    program?: Program;
    stream?: Stream;
    listeners?: Listeners;
    isPlaying: boolean;
  }>({ isPlaying: false });

  const playerServiceInstance = useMemo(() => playerService(), []);

  useEffect(() => {
    const initializePlayer = async () => {
      console.log("[PlayerProvider] Initializing playerServiceInstance...");
      setState({
        stream: playerServiceInstance._currentStream,
        isPlaying: false,
      });
      console.log("[PlayerProvider] Player initialized.");
    };
    initializePlayer();
    return () => {
      console.log("[PlayerProvider] Cleaning up playerServiceInstance...");
      playerServiceInstance.destroy();
    };
  }, [playerServiceInstance]);

  const play = async () => {
    console.log("[PlayerProvider] Play requested.");
    await playerServiceInstance.play();
    setState((prev) => ({
      ...prev,
      isPlaying: true,
      track: playerServiceInstance._currentTrack || undefined,
      program: playerServiceInstance._currentProgram || undefined,
      stream: playerServiceInstance._currentStream,
      listeners: playerServiceInstance._listeners || undefined,
      progress: getTrackProgress(
        playerServiceInstance._currentTrack || undefined
      ),
    }));
  };

  const pause = async () => {
    console.log("[PlayerProvider] Pause requested.");
    await playerServiceInstance.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
  };

  const changeStream = async (stream: Stream) => {
    console.log("[PlayerProvider] Stream change requested.");
    await playerServiceInstance.changeStream(stream);
    setState((prev) => ({
      ...prev,
      stream,
      // Keep current playing state; you might also update track and program if needed.
    }));
  };

  const updateCurrentTrackProgress = async () => {
    setState((prev) => ({
      ...prev,
      progress: getTrackProgress(
        playerServiceInstance._currentTrack || undefined
      ),
    }));
  };

  const refreshData = async () => {
    const hasChanges = await playerServiceInstance.refreshData();
    if (!hasChanges) return;
    setState((prev) => ({
      ...prev,
      track: playerServiceInstance._currentTrack || undefined,
      program: playerServiceInstance._currentProgram || undefined,
      listeners: playerServiceInstance._listeners || undefined,
    }));
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
        currentProgram: state.program,
        currentStream: state.stream,
        currentListeners: state.listeners,
        isPlaying: state.isPlaying,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
