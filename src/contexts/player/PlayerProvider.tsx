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
import { Stream } from "@/core/domain/stream";
import { playerService } from "@/core/player";
import { backgroundService } from "@/core/services/background.service";
import { subscribeAssistantActions } from "@/core/assistant";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
  type VisualizerWindow,
} from "@/core/player";
import { Loading } from "@/screens/Loading";
import { hideSplashOnce } from "@/screens/Loading/splash";

const HEARTBEAT_INTERVAL = 1000; // 1s fallback driver (see HeartbeatScheduler)

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
   * Reports the delay (ms) the visualizer actually applied for the last
   * window, so the native sampler can auto-calibrate its sync offset.
   */
  reportVisualizerDelay: (appliedMs: number) => void;
};

const PlayerContext = createContext<PlayerContextType>({
  play: () => Promise.reject("Player not initialized"),
  pause: () => Promise.reject("Player not initialized"),
  changeStream: () => Promise.reject("Player not initialized"),
  refreshData: () => Promise.reject("Player not initialized"),
  refreshHistory: () => Promise.reject("Player not initialized"),
  defaultArtwork: "",
  visualizerSupported: false,
  subscribeVisualizerWindows: () => () => {},
  reportVisualizerDelay: () => {},
  isPlaying: false,
  playbackState: "idle",
  isInitialized: false,
  syncing: false,
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
  const isBackgrounded = useIsBackgrounded();

  // ─── Background UI freeze: stop store emissions while hidden ───
  // The service keeps the native player + media session running; it just
  // stops writing the React stores (and slows the metadata poll) until the
  // app is foregrounded again, when it re-emits everything.
  useEffect(() => {
    playerServiceInstance.setAppActive(!isBackgrounded);
  }, [isBackgrounded, playerServiceInstance]);

  // ─── Initialization & background tasks ───
  useEffect(() => {
    let cancelled = false;
    let unsubscribeAssistant: (() => void) | null = null;
    // A Siri/Google deep link can land before the player has a stream to
    // resolve (cold start via an App Intent). Buffer it instead of dropping it.
    let assistantPlayPending = false;

    const playFromAssistant = () => {
      playerServiceInstance.play().catch((error) => {
        console.warn("[PlayerProvider] Assistant play failed:", error);
      });
    };

    // Phone assistants (Siri / Google) deep-link into playback. Subscribe
    // BEFORE bootstrap: a deep-link "url" event that arrives while the player
    // is still booting would otherwise fire with no listener attached.
    unsubscribeAssistant = subscribeAssistantActions((action) => {
      if (action !== "play") return;
      if (playerServiceInstance.isReady) {
        playFromAssistant();
      } else {
        assistantPlayPending = true;
      }
    });

    const initializePlayer = async () => {
      try {
        playerServiceInstance.setRemoteHandlers({
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

        if (cancelled) return;

        // Drain a deep link that arrived while the player was still booting.
        if (assistantPlayPending) {
          assistantPlayPending = false;
          playFromAssistant();
        }
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

      unsubscribeAssistant?.();
      appStateSubscription?.remove();
      backgroundService.stopTask("heartbeat");
      playerServiceInstance.setRemoteHandlers({
        play: async () => {},
        pause: async () => {},
        toggle: async () => {},
        stop: async () => {},
      });

      playerServiceInstance.destroy().catch(console.error);
    };
  }, [playerServiceInstance]);

  // ─── Dismiss the native splash once the first real screen can render ───
  useEffect(() => {
    if (playerSnapshot.isInitialized) hideSplashOnce();
  }, [playerSnapshot.isInitialized]);

  // ─── Heartbeat driver: while visible or playing, otherwise suspended ───
  //
  // The 1 Hz JS fallback driver (see `HeartbeatScheduler` for what a beat
  // does: progress tick + refresh watchdog + data-poll cadence — the 5s/
  // 30s poll policy lives THERE, once). The native playbackStatusUpdate
  // stream beats into the same scheduler while playing, which is what
  // keeps everything fresh in the background where these JS timers
  // freeze/throttle.
  //
  // - Playing (foreground or background): runs — scheduler polls every 5s.
  // - Paused + foreground: runs — scheduler polls every 30s (battery
  //   friendly; badge/history stay fresh).
  // - Paused + background: suspended — nothing visible can change, so
  //   polling would be pure battery/radio-data waste.
  useEffect(() => {
    if (!playerSnapshot.isInitialized) return;

    const shouldPoll = playerSnapshot.isPlaying || appState === "active";

    if (!shouldPoll) {
      backgroundService.stopTask("heartbeat");
      return;
    }

    // startTask restarts cleanly by id — safe on every effect re-run
    backgroundService.startTask({
      id: "heartbeat",
      callback: async () => {
        playerServiceInstance.heartbeat();
      },
      interval: HEARTBEAT_INTERVAL,
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

  const reportVisualizerDelay = useCallback(
    (appliedMs: number) =>
      playerServiceInstance.reportVisualizerDelay(appliedMs),
    [playerServiceInstance],
  );

  // ─── Context values ───

  const playerContextValue = useMemo<PlayerContextType>(
    () => ({
      ...playerSnapshot,
      play,
      pause,
      changeStream,
      refreshData,
      refreshHistory,
      defaultArtwork: playerServiceInstance.defaultArtwork,
      // Re-read on every snapshot change so it flips true once the native
      // player exists (created on first play).
      visualizerSupported: playerServiceInstance.isVisualizerSupported,
      subscribeVisualizerWindows,
      reportVisualizerDelay,
    }),
    [
      playerSnapshot,
      play,
      pause,
      changeStream,
      refreshData,
      refreshHistory,
      playerServiceInstance,
      subscribeVisualizerWindows,
      reportVisualizerDelay,
    ],
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
