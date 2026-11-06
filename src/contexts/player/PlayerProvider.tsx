import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
} from "react";
import { playerService } from "@/core/player";
import { subscribeAssistantActions } from "@/core/assistant";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
  type HeardPosition,
  type QualityChoice,
  type SleepChoice,
  type VisualizerWindow,
} from "@/core/player";
import { hideSplashOnce } from "@/utils/splash";
import { useExternalStore } from "@/hooks/useExternalStore";

// ─── Contexts by change cadence — subscribe to the one you need ───
//
// - usePlayer()        → now-playing data + actions (per song / action)
// - useStation()       → listeners + histories (per API poll)
// - useTrackProgress() → progress (per re-anchor)
//
// A component reading from only one context never re-renders for the
// others' updates.

type PlayerContextType = PlayerSnapshot & {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  /** A stream the listener picked, or automatic quality (`AUTO_QUALITY`). */
  changeStream: (choice: QualityChoice) => Promise<void>;
  /**
   * Sets the sleep timer (`null` cancels). Resolves `false` when it could not
   * be set: the end of a song whose length or place is not known.
   */
  setSleepTimer: (choice: SleepChoice | null) => Promise<boolean>;
  refreshData: () => Promise<void>;
  /** Refreshes one history feed — pull-to-refresh on the history lists. */
  refreshHistory: (type: "requests" | "played") => Promise<void>;
  /** Bundled default cover as a loadable URI (see `ArtworkResolver`). */
  defaultArtwork: string;
  /** Whether the platform can sample audio for the visualizer. */
  visualizerSupported: boolean;
  /**
   * Hot-path subscription to raw waveform windows — the WebView visualizer
   * interpolates and draws them itself (no RN-side per-frame work).
   */
  subscribeVisualizerWindows: (
    listener: (window: VisualizerWindow) => void,
  ) => () => void;
  /**
   * Hot-path read of the heard song's position (see
   * `PlayerService.heardPosition`) — sampled by the lyrics clock, which
   * animates between samples itself.
   */
  readHeardPosition: () => HeardPosition | null;
};

// Pre-bootstrap sentinels: callers that mount before `setupPlayer` resolves
// hit a real Error (with a stack) instead of a bare string reason that would
// vanish silently if the rejection goes unhandled. Consumers that legitimately
// race bootstrap already `.catch()` these.
const notInitialized = () =>
  Promise.reject(new Error("[PlayerProvider] player not initialized"));

const PlayerContext = createContext<PlayerContextType>({
  play: notInitialized,
  pause: notInitialized,
  changeStream: notInitialized,
  setSleepTimer: notInitialized,
  refreshData: notInitialized,
  refreshHistory: notInitialized,
  defaultArtwork: "",
  visualizerSupported: false,
  subscribeVisualizerWindows: () => () => {},
  readHeardPosition: () => null,
  isPlaying: false,
  playbackState: "idle",
  isInitialized: false,
  syncing: false,
});

const StationContext = createContext<StationSnapshot>({});

const ProgressContext = createContext<ProgressSnapshot>({
  progressMs: null,
  progressAt: 0,
  progressRunning: false,
  showProgress: false,
  durationMs: 0,
});

export const PlayerProvider: React.FC<{
  children: React.ReactNode;
  /** Shown until the player is set up (the app's loading screen). */
  fallback: React.ReactNode;
}> = ({ children, fallback }) => {
  // Singleton service — plain call, no memoization (the compiler treats
  // memoized objects as frozen, and the player is inherently mutable)
  const playerServiceInstance = playerService();

  /** Raises an async failure into render, where error boundaries catch it. */
  const [, raiseRenderError] = useReducer((_: null, error: unknown): null => {
    throw error;
  }, null);

  // ─── Subscribe to stores — the service is the single source of truth ───
  const playerSnapshot = useExternalStore(playerStore);
  const stationSnapshot = useExternalStore(stationStore);
  const progressSnapshot = useExternalStore(progressStore);

  // ─── App visibility — gates the poll lifecycle ───
  // AppStateProvider owns the app's single native AppState listener.
  const isBackgrounded = useIsBackgrounded();

  // ─── Background UI freeze: stop store emissions while hidden ───
  // The service keeps the native player + media session running; it just
  // stops writing the React stores (and slows the metadata poll) until the
  // app is foregrounded again, when it re-emits everything and refreshes
  // data the frozen JS timers left stale.
  useEffect(() => {
    playerServiceInstance.setAppActive(!isBackgrounded);
  }, [isBackgrounded, playerServiceInstance]);

  // ─── Visualizer wiring ───
  // Uncapped, like the web player's rAF loop: emitting the trace runs without
  // a rate cap and the visualizer commits each frame at the display's own
  // vsync, self-adapting per device. `0` = off, `> 0` = on.
  const visualizerOn = useUserSettings().settings.visualizerHz > 0;
  useEffect(() => {
    playerServiceInstance.setVisualizerEnabled(visualizerOn);
  }, [visualizerOn, playerServiceInstance]);

  // ─── Initialization & background tasks ───
  useEffect(() => {
    let cancelled = false;
    // An `animuapp://assistant/play` link can land before the player has a
    // stream to resolve (cold start). Buffer it instead of dropping it. (Siri
    // and Google Assistant play natively, through the voice catalog.)
    let assistantPlayPending = false;

    const playFromAssistant = () => {
      playerServiceInstance.play().catch((error: unknown) => {
        console.warn("[PlayerProvider] Assistant play failed:", error);
      });
    };

    // An `animuapp://assistant/play` link starts playback. Subscribe BEFORE
    // bootstrap: a deep-link "url" event that arrives while the player is
    // still booting would otherwise fire with no listener attached.
    // "play" is the only assistant action.
    const unsubscribeAssistant = subscribeAssistantActions(() => {
      if (playerServiceInstance.isReady) {
        playFromAssistant();
      } else {
        assistantPlayPending = true;
      }
    });

    const initializePlayer = async () => {
      try {
        // Lock screen / headset / car commands are handled natively by the
        // player (react-native-anything-player); the UI follows its status.
        // Single call: streams + stored pref + settings + data fetch
        await playerServiceInstance.setupPlayer();

        if (cancelled) return;

        // Drain a deep link that arrived while the player was still booting.
        if (assistantPlayPending) {
          assistantPlayPending = false;
          playFromAssistant();
        }
      } catch (error) {
        // A failed setup (local storage; the network has fallbacks) goes to
        // the root ErrorBoundary, whose retry remounts this provider with a
        // fresh service, instead of the loader spinning forever.
        if (!cancelled) raiseRenderError(error);
      }
    };

    void initializePlayer();

    return () => {
      cancelled = true;

      unsubscribeAssistant();

      playerServiceInstance.destroy().catch(console.error);
    };
  }, [playerServiceInstance]);

  // ─── Dismiss the native splash once the first real screen can render ───
  useEffect(() => {
    if (playerSnapshot.isInitialized) hideSplashOnce();
  }, [playerSnapshot.isInitialized]);

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
    async (choice: QualityChoice) => {
      try {
        await playerServiceInstance.changeStream(choice);
      } catch (error) {
        console.error("[PlayerProvider] Stream change error:", error);
      }
    },
    [playerServiceInstance],
  );

  const setSleepTimer = useCallback(
    async (choice: SleepChoice | null) => {
      try {
        return await playerServiceInstance.setSleepTimer(choice);
      } catch (error) {
        console.error("[PlayerProvider] Sleep timer error:", error);
        return false;
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

  const refreshHistory = useCallback(
    async (type: "requests" | "played") => {
      try {
        await playerServiceInstance.refreshHistory(type);
      } catch (error) {
        console.error("[PlayerProvider] Error refreshing history:", error);
      }
    },
    [playerServiceInstance],
  );

  const subscribeVisualizerWindows = useCallback(
    (listener: (window: VisualizerWindow) => void) =>
      playerServiceInstance.subscribeVisualizerWindows(listener),
    [playerServiceInstance],
  );

  const readHeardPosition = useCallback(
    () => playerServiceInstance.heardPosition(),
    [playerServiceInstance],
  );

  // ─── Context values ───

  const playerContextValue = useMemo<PlayerContextType>(
    () => ({
      ...playerSnapshot,
      play,
      pause,
      changeStream,
      setSleepTimer,
      refreshData,
      refreshHistory,
      defaultArtwork: playerServiceInstance.artwork.defaultCover,
      // Re-read on every snapshot change so it flips true once the native
      // player exists (created on first play).
      visualizerSupported: playerServiceInstance.isVisualizerSupported,
      subscribeVisualizerWindows,
      readHeardPosition,
    }),
    [
      playerSnapshot,
      play,
      pause,
      changeStream,
      setSleepTimer,
      refreshData,
      refreshHistory,
      playerServiceInstance,
      subscribeVisualizerWindows,
      readHeardPosition,
    ],
  );

  return (
    <PlayerContext.Provider value={playerContextValue}>
      <StationContext.Provider value={stationSnapshot}>
        <ProgressContext.Provider value={progressSnapshot}>
          {playerSnapshot.isInitialized ? children : fallback}
        </ProgressContext.Provider>
      </StationContext.Provider>
    </PlayerContext.Provider>
  );
};

/** Now-playing data + playback actions (per song / program / action). */
export const usePlayer = () => useContext(PlayerContext);

/** Poll data — current listeners and the request/played histories. */
export const useStation = () => useContext(StationContext);

/** Track progress: a real-time anchor, re-published only when it moves. */
export const useTrackProgress = () => useContext(ProgressContext);
