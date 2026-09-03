import { HistoryType } from "./../../@types/history-type.d";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openBrowserAsync } from "expo-web-browser";
import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioStatus,
  type AudioSource,
} from "expo-audio";
import NetInfo from "@react-native-community/netinfo";
import type { NowPlayingMetadata } from "react-native-playback-controls";
import { Stream } from "../domain/stream";
import { getTrackProgress, Track } from "../domain/track";
import { Program } from "../domain/program";
import { Listeners } from "../domain/listeners";
import { animuService } from "../services/animu.service";
import { CONFIG } from "../../utils/player.config";
import { API } from "../../api";
import { userSettingsService } from "./user-settings.service";
import { SetupService } from "./player-setup.service";
import {
  EndPlaybackSession,
  setNowPlayingMetadata,
  setRemotePlaybackStatus,
} from "./player-playback.service";
import { PlayerSnapshot, playerStore, progressStore } from "./player-store";
import { fetchStreams } from "../../data/http/animu-streams.api";

// ── One-shot timers (plain JS timers) ──
const _setTimeout = (fn: () => void, ms: number): number =>
  setTimeout(fn, ms) as unknown as number;

const _clearTimeout = (id: number | null): void => {
  if (id == null) return;
  clearTimeout(id as unknown as NodeJS.Timeout);
};

/** Buffer after expected track end before fetching (ms) */
const TRACK_END_BUFFER_MS = 500;
/** Max backoff delay on consecutive network errors (ms) */
const MAX_RETRY_DELAY_MS = 30_000;
/** Base retry delay (ms) — doubles each consecutive error */
const BASE_RETRY_DELAY_MS = 2_000;

/** Builds an expo-audio source for a live stream with the app User-Agent */
const buildStreamSource = (url: string): AudioSource => ({
  uri: url,
  headers: { "User-Agent": CONFIG.USER_AGENT },
});

/** ms → seconds for the native media session, rejecting NaN/Infinity */
const toSec = (ms: number | null | undefined): number | undefined =>
  ms != null && Number.isFinite(ms) ? ms / 1000 : undefined;

/**
 * Native-driven tick interval (ms). expo-audio emits playbackStatusUpdate
 * events from the native layer — these keep firing while the app is
 * backgrounded on Android (the foreground service keeps the process alive),
 * unlike Choreographer-driven JS timers which OEMs pause in background.
 */
const PLAYER_TICK_INTERVAL_MS = 1000;
/** Base delay between stream reconnect attempts (ms) — doubles each retry */
const BASE_RECONNECT_DELAY_MS = 2_000;
/** Max delay between stream reconnect attempts (ms) */
const MAX_RECONNECT_DELAY_MS = 30_000;

export interface PlayerServiceProps {
  CONFIG: typeof CONFIG;
  player: AudioPlayer | null;
  _currentStream: Stream;
  _streamOptions: Stream[];
  _currentTrack: Track | null;
  _currentProgram: Program | null;
  _lastRequestedTracks: Track[] | null;
  _lastPlayedTracks: Track[] | null;
  _listeners: Listeners | null;
  _paused: boolean;
  _isRefreshing: boolean;
  _lastMetadataTitle: string;
  /** Whether the audio mode + media session setup has been called */
  _nativeSetupDone: boolean;
  /** Whether to show real progress in the media session notification */
  _showMediaProgress: boolean;
  /** Counter for throttling native metadata pushes in _tickProgress */
  _nativeProgressTickCount: number;
  _isInitialized: boolean;
  /** Timeout ID for the one-shot track-end refresh */
  _trackEndTimeoutId: number | null;
  /** Native playbackStatusUpdate listener (keeps ticks alive in background) */
  _statusListener: { remove(): void } | null;
  /** Timeout ID for exponential-backoff retry on network errors */
  _retryTimeoutId: number | null;
  /** Timeout ID for pending stream reconnect attempt */
  _reconnectTimeoutId: number | null;
  /** Consecutive stream reconnect attempts (reset when audio plays) */
  _reconnectAttempts: number;
  /** Whether the stream has actually played once (guards false reconnects) */
  _streamStarted: boolean;
  /** Last known network connectivity (null = unknown) */
  _wasConnected: boolean | null;
  /** NetInfo listener unsubscribe fn */
  _networkUnsubscribe: (() => void) | null;
  /** Consecutive network errors (reset on success) — drives backoff */
  _consecutiveErrors: number;
  isPlayerSetup: () => Promise<boolean>;
  _isRealTrack: (track: Track) => boolean;
  /** Schedule a one-shot refresh at the expected track-end time */
  _scheduleTrackEndRefresh: () => void;
  /** Attach the native status listener that drives _tickProgress */
  _attachStatusListener: () => void;
  /** Cancel any pending track-end or retry timers */
  _cancelScheduledRefresh: () => void;
  /** Schedule an exponential-backoff retry after a network error */
  _scheduleRetry: () => void;
  /** Handle native playback status events (progress + stream-loss detection) */
  _handlePlaybackStatus: (status: AudioStatus) => void;
  /** Schedule an exponential-backoff stream reconnect */
  _scheduleReconnect: () => void;
  /** Cancel any pending stream reconnect */
  _cancelReconnect: () => void;
  /** Replace the stream source and resume playback (live point) */
  _attemptReconnect: () => Promise<void>;
  /** Subscribe to connectivity changes for instant reconnect + data refresh */
  _subscribeToNetwork: () => void;
  /**
   * Single entry-point that bootstraps everything the player needs:
   * streams from API, stored stream preference, native TrackPlayer,
   * first data fetch, and media session preload.
   */
  setupPlayer: () => Promise<void>;
  /** Fire-and-forget media session preload */
  _preloadMediaSession: () => Promise<void>;
  refreshData: (isToUpdateMetadata?: boolean) => Promise<boolean>;
  getNowPlayingMetadata: () => NowPlayingMetadata;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  openPedidosURL: () => Promise<void>;
  updateMetadata: () => Promise<void>;
  updateNowPlayingProgress: () => Promise<void>;
  destroy: () => Promise<void>;
  refreshHistory: (type: HistoryType) => Promise<void>;
  _emitState: () => void;
  _emitProgress: () => void;
  _tickProgress: () => Promise<void>;
}

let playerServiceInstance: PlayerServiceProps | null = null;

export const playerService = (): PlayerServiceProps => {
  if (!playerServiceInstance) {
    playerServiceInstance = {
      CONFIG,
      player: null,
      _currentStream: CONFIG.DEFAULT_STREAM_OPTION,
      _streamOptions: [],
      _currentTrack: null,
      _lastPlayedTracks: null,
      _lastRequestedTracks: null,
      _currentProgram: null,
      _listeners: null,
      _paused: true,
      _lastMetadataTitle: "",
      _nativeSetupDone: false,
      _showMediaProgress: false,
      _nativeProgressTickCount: 0,
      _isInitialized: false,
      _trackEndTimeoutId: null,
      _retryTimeoutId: null,
      _reconnectTimeoutId: null,
      _reconnectAttempts: 0,
      _streamStarted: false,
      _wasConnected: null,
      _networkUnsubscribe: null,
      _statusListener: null,
      _consecutiveErrors: 0,

      _isRefreshing: false,

      /** Attach the native status listener that drives _tickProgress */
      _attachStatusListener(): void {
        if (!this.player || this._statusListener) return;
        this._statusListener = this.player.addListener(
          "playbackStatusUpdate",
          (status: AudioStatus) => {
            this._handlePlaybackStatus(status);
          },
        );
      },

      /**
       * Native playback status handler. Drives reconnect detection:
       * Android surfaces a dead stream as playbackState "idle" (ExoPlayer
       * exhausts its internal retries and stops — expo-audio never retries),
       * iOS as "failed" (AVPlayer .failed status).
       */
      _handlePlaybackStatus(status: AudioStatus): void {
        // Stream is actually producing audio — reset reconnect backoff
        if (status.playing) {
          this._streamStarted = true;
          this._reconnectAttempts = 0;
          this._cancelReconnect();
        }

        // Stream died while the user wants playback → schedule reconnect
        if (
          !this._paused &&
          !status.playing &&
          !status.isBuffering &&
          this._streamStarted &&
          (status.playbackState === "idle" ||
            status.playbackState === "failed")
        ) {
          this._scheduleReconnect();
        }
      },

      _scheduleReconnect(): void {
        if (this._reconnectTimeoutId != null) return;

        // Exponential backoff: 2s → 4s → 8s → 16s → 30s (cap)
        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * Math.pow(2, this._reconnectAttempts),
          MAX_RECONNECT_DELAY_MS,
        );
        this._reconnectAttempts++;

        console.warn(
          `[PlayerService] Stream lost — reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})`,
        );

        this._reconnectTimeoutId = _setTimeout(() => {
          this._reconnectTimeoutId = null;
          this._attemptReconnect().catch(console.error);
        }, delay);
      },

      _cancelReconnect(): void {
        _clearTimeout(this._reconnectTimeoutId);
        this._reconnectTimeoutId = null;
      },

      /**
       * Reconnects to the live stream: replaces the audio source (which
       * re-opens the connection at the current live point — there is no
       * gapless resume on a radio stream) and resumes playback.
       */
      async _attemptReconnect(): Promise<void> {
        if (this._paused || !this.player) return;

        try {
          this.player.replace(buildStreamSource(this._currentStream.url));
          this.player.play();
          setRemotePlaybackStatus("buffering");
        } catch (error) {
          console.error("[PlayerService] Reconnect attempt failed:", error);
          this._scheduleReconnect();
        }
      },

      /** Subscribe to connectivity changes for instant reconnect + refresh */
      _subscribeToNetwork(): void {
        if (this._networkUnsubscribe) return;

        this._networkUnsubscribe = NetInfo.addEventListener((state) => {
          const isConnected = !!state.isConnected;
          const wasConnected = this._wasConnected;
          this._wasConnected = isConnected;

          // React only to the offline → online transition (netinfo also
          // emits once immediately on subscribe)
          if (wasConnected === false && isConnected) {
            console.info("[PlayerService] Network restored");

            // Instant reconnect instead of waiting the backoff out
            this._cancelReconnect();
            this._reconnectAttempts = 0;

            if (!this._paused) {
              this._attemptReconnect().catch(console.error);
            }

            // Refresh all API data (track, program, listeners, history)
            this.refreshData().catch(console.error);
          }
        });
      },

      _scheduleTrackEndRefresh(): void {
        // Cancel any previous track-end timer
        _clearTimeout(this._trackEndTimeoutId);
        this._trackEndTimeoutId = null;

        if (!this._currentTrack || this._currentTrack.duration <= 0) return;

        // Don't schedule for non-real tracks (jingles, transitions) or live
        if (!this._isRealTrack(this._currentTrack)) return;
        if (this._currentProgram?.isLive) return;

        const now = Date.now();
        const trackEnd =
          this._currentTrack.startTime.getTime() + this._currentTrack.duration;
        const msUntilEnd = trackEnd - now;

        if (msUntilEnd <= 0) {
          // Track already ended — refresh soon
          this._trackEndTimeoutId = _setTimeout(() => {
            this._trackEndTimeoutId = null;
            this.refreshData().catch(console.error);
          }, 1000);
          return;
        }

        const delay = msUntilEnd + TRACK_END_BUFFER_MS;

        this._trackEndTimeoutId = _setTimeout(() => {
          this._trackEndTimeoutId = null;
          this.refreshData().catch(console.error);
        }, delay);
      },

      _cancelScheduledRefresh(): void {
        _clearTimeout(this._trackEndTimeoutId);
        this._trackEndTimeoutId = null;
        _clearTimeout(this._retryTimeoutId);
        this._retryTimeoutId = null;
      },

      _scheduleRetry(): void {
        _clearTimeout(this._retryTimeoutId);

        // Exponential backoff: 2s → 4s → 8s → 16s → 30s (cap)
        const delay = Math.min(
          BASE_RETRY_DELAY_MS * Math.pow(2, this._consecutiveErrors - 1),
          MAX_RETRY_DELAY_MS,
        );

        this._retryTimeoutId = _setTimeout(() => {
          this._retryTimeoutId = null;
          this.refreshData().catch(console.error);
        }, delay);
      },

      _isRealTrack(track: Track): boolean {
        return (
          !track.anime?.toLowerCase().includes("passagem") &&
          !track.artist?.toLowerCase().includes("r\u00e1dio animu") &&
          !track.anime?.toLowerCase().includes("animu")
        );
      },

      async setupPlayer(): Promise<void> {
        // ── Phase 1: fire EVERYTHING that has no interdependencies ──
        // Streams, stored preference, native TrackPlayer, and user
        // settings all resolve independently — run them all at once.
        const [
          streams,
          storedStreamRaw, // SetupService — void
          ,
          userSettings, // UserSettings — pre-warm cache
        ] = await Promise.all([
          fetchStreams(),
          AsyncStorage.getItem("currentStream"),
          SetupService().then(() => {
            this._nativeSetupDone = true;
          }),
          userSettingsService.initialize(),
        ]);

        this._streamOptions = streams;

        // Watch connectivity: instant reconnect + data refresh when back online
        this._subscribeToNetwork();

        // Resolve the user's preferred stream (or default to first)
        const storedStream: Stream | null = storedStreamRaw
          ? JSON.parse(storedStreamRaw)
          : null;

        if (storedStream && streams.find((s) => s.id === storedStream.id)) {
          this._currentStream = storedStream;
        } else {
          // First launch or stored stream no longer exists — pick first from API
          this._currentStream = streams[0] ?? CONFIG.DEFAULT_STREAM_OPTION;
          // Persist immediately so every other code path sees a valid stream
          await AsyncStorage.setItem(
            "currentStream",
            JSON.stringify(this._currentStream),
          );
        }

        // ── Phase 2: first data fetch (needs stream + settings ready) ──
        try {
          await this.refreshData();
        } catch (err) {
          console.warn(
            "[PlayerService] setupPlayer: initial data fetch failed:",
            err,
          );
        }

        // Mark initialized ASAP — UI can render now
        this._isInitialized = true;
        this._emitState();
        this._emitProgress();

        // ── Phase 3: media session preload (non-blocking) ──
        // Fire-and-forget: the notification player is nice-to-have,
        // the UI is already interactive.
        if (this._currentTrack && this._nativeSetupDone) {
          this._preloadMediaSession().catch((err) =>
            console.warn(
              "[PlayerService] setupPlayer: media preload failed:",
              err,
            ),
          );
        }
      },

      /** Fire-and-forget media session preload */
      async _preloadMediaSession(): Promise<void> {
        const metadata = this.getNowPlayingMetadata();
        setNowPlayingMetadata(metadata);
        setRemotePlaybackStatus(this._paused ? "paused" : "playing");
      },

      _emitState(): void {
        const next: PlayerSnapshot = {
          currentTrack: this._currentTrack || undefined,
          lastPlayedTracks: this._lastPlayedTracks || undefined,
          lastRequestedTracks: this._lastRequestedTracks || undefined,
          currentProgram: this._currentProgram || undefined,
          currentStream: this._currentStream,
          streamOptions: this._streamOptions,
          currentListeners: this._listeners || undefined,
          isPlaying: !this._paused,
          isInitialized: this._isInitialized,
        };
        playerStore.setSnapshot(next);
      },

      _emitProgress(): void {
        progressStore.setSnapshot({
          currentTrackProgress: getTrackProgress(
            this._currentTrack || undefined,
          ),
          showProgress: this._showMediaProgress,
        });
      },

      async _tickProgress(): Promise<void> {
        // Fast exit — no work when no track
        if (!this._currentTrack) return;

        const elapsed = getTrackProgress(this._currentTrack || undefined);
        const prev = progressStore.getSnapshot();

        // Only emit if the value actually changed (avoids 1/sec React re-render)
        if (
          prev.currentTrackProgress !== elapsed ||
          prev.showProgress !== this._showMediaProgress
        ) {
          progressStore.setSnapshot({
            currentTrackProgress: elapsed,
            showProgress: this._showMediaProgress,
          });
        }

        // Detect track end
        if (!this._showMediaProgress) return;

        if (elapsed == null) {
          this._showMediaProgress = false;
          this._nativeProgressTickCount = 0;
          progressStore.setSnapshot({
            currentTrackProgress: null,
            showProgress: false,
          });
          try {
            if (this._nativeSetupDone) {
              const cleanMeta = this.getNowPlayingMetadata();
              setNowPlayingMetadata(cleanMeta);
              setRemotePlaybackStatus(
                this._paused ? "paused" : "playing",
                0,
              );
            }
          } catch {
            // best-effort
          }
          return;
        }

        // Periodically push elapsed time to the native media session.
        // The OS interpolates the seek bar between snapshots.
        // Push every ~3 ticks (3 seconds at 1s interval).
        this._nativeProgressTickCount++;
        if (this._nativeProgressTickCount >= 3) {
          this._nativeProgressTickCount = 0;
          if (this._nativeSetupDone && (await this.isPlayerSetup())) {
            try {
              const meta = this.getNowPlayingMetadata();
              setNowPlayingMetadata(meta);
              setRemotePlaybackStatus(
                this._paused ? "paused" : "playing",
                toSec(elapsed),
              );
            } catch {
              // best-effort
            }
          }
        }
      },

      async isPlayerSetup(): Promise<boolean> {
        // Fast path — if native setup never completed, skip checks
        if (!this._nativeSetupDone || !this._currentTrack) return false;

        return !!this.player;
      },

      async refreshData(isToUpdateMetadata = true): Promise<boolean> {
        if (this._isRefreshing) return false;
        this._isRefreshing = true;
        try {
          const [
            { track: newTrack, listeners: newListeners },
            newProgram,
            newLastRequestedTracks,
          ] = await Promise.all([
            animuService.getStreamMetadata(
              userSettingsService.getCurrentSettings().liveQualityCover,
            ),
            animuService.getCurrentProgram(),
            animuService.getTrackHistory("requests"),
          ]);

          if (!newTrack) {
            console.warn(
              "[PlayerService] API returned invalid track data, skipping update",
            );
            return false;
          }

          let hasChanges = false;

          if (
            this._currentTrack?.raw !== newTrack.raw ||
            this._currentTrack?.artwork !== newTrack.artwork
          ) {
            const prevTrackRaw = this._currentTrack?.raw;
            this._currentTrack = newTrack;
            this.refreshHistory("played");
            hasChanges = true;

            // Enable progress for real, non-live tracks (radio keeps
            // playing server-side so we always show progress).
            if (this._isRealTrack(newTrack) && !newProgram.isLive) {
              this._showMediaProgress = true;
              this._nativeProgressTickCount = 0;
              const elapsed = getTrackProgress(newTrack);
            } else {
              this._showMediaProgress = false;
            }
          }

          if (
            this._currentProgram?.name !== newProgram.name ||
            this._currentProgram?.dj !== newProgram.dj ||
            this._currentProgram?.isLive !== newProgram.isLive
          ) {
            this._currentProgram = newProgram;
            hasChanges = true;
          }

          if (this._listeners?.value !== newListeners.value) {
            this._listeners = newListeners;
            hasChanges = true;
          }

          if (
            newLastRequestedTracks.length > 0 &&
            newLastRequestedTracks[0].raw !==
              (this._lastRequestedTracks?.[0]?.raw || "")
          ) {
            this._lastRequestedTracks = newLastRequestedTracks;
            hasChanges = true;
          }

          if (
            hasChanges &&
            (await this.isPlayerSetup()) &&
            isToUpdateMetadata
          ) {
            await this.updateMetadata();

            // PlaybackControls interpolates the seek bar from the position
            // snapshot pushed by _tickProgress — no native seek needed.
          }

          if (hasChanges) {
            this._emitState();
          }

          // ── Success: reset error backoff & schedule track-end refresh ──
          this._consecutiveErrors = 0;
          _clearTimeout(this._retryTimeoutId);
          this._retryTimeoutId = null;
          this._scheduleTrackEndRefresh();

          return hasChanges;
        } catch (error) {
          console.error("[PlayerService] Error refreshing data:", error);

          // ── Network / API error: exponential backoff retry ──
          this._consecutiveErrors++;
          this._scheduleRetry();

          return false;
        } finally {
          this._isRefreshing = false;
        }
      },

      getNowPlayingMetadata(): NowPlayingMetadata {
        const isLive = this._currentProgram?.isLive ?? false;

        const baseMetadata: NowPlayingMetadata = this._currentTrack
          ? {
              title: this._currentTrack.metadata.title || "N/A",
              artist: this._currentTrack.metadata.artist || "N/A",
              artwork:
                this._currentTrack.metadata.artwork || CONFIG.DEFAULT_COVER,
              isLiveStream: isLive,
            }
          : {
              title: "N/A",
              artist: "N/A",
              artwork: CONFIG.DEFAULT_COVER,
              isLiveStream: isLive,
            };

        // Show REAL duration from the track data
        if (
          this._showMediaProgress &&
          this._currentTrack &&
          this._currentTrack.duration > 0
        ) {
          return {
            ...baseMetadata,
            durationSec: this._currentTrack.duration / 1000,
          };
        }

        // No progress: no duration so the bar is empty/hidden
        return baseMetadata;
      },

      async play(): Promise<void> {
        // Ensure audio mode + media session are set up
        if (!this._nativeSetupDone) {
          try {
            await SetupService();
            this._nativeSetupDone = true;

            // Resolve stream: prefer AsyncStorage, then already-fetched options,
            // then hardcoded fallback. On first launch setupPlayer() already
            // persisted the default, so AsyncStorage should have a value.
            const storedStream = await AsyncStorage.getItem("currentStream");
            if (storedStream) {
              this._currentStream = JSON.parse(storedStream);
            } else if (this._streamOptions.length > 0) {
              this._currentStream = this._streamOptions[0];
            }
            // else: keep the existing _currentStream (already set by setupPlayer or init)
          } catch (err) {
            console.error("[PlayerService] Setup error:", err);
            throw err;
          }
        }

        try {
          const source = buildStreamSource(this._currentStream.url);

          // Fresh playback session: clear any reconnect state
          this._cancelReconnect();
          this._reconnectAttempts = 0;
          this._streamStarted = false;

          if (this.player) {
            this.player.replace(source);
          } else {
            this.player = createAudioPlayer(source, {
              updateInterval: PLAYER_TICK_INTERVAL_MS,
            });
            this._attachStatusListener();
          }

          this.player.play();
          this._paused = false;

          // Fetch fresh data + push metadata in one go
          await this.refreshData();
          await this.updateMetadata();

          this._emitState();
          this._emitProgress();
        } catch (error) {
          this._emitState();
          this._emitProgress();
          console.error("[PlayerService] Playback error:", error);
          throw error;
        }
      },

      async pause(): Promise<void> {
        if ((await this.isPlayerSetup()) && !this._paused) {
          try {
            this.player?.pause();
            this._paused = true;
            setRemotePlaybackStatus("paused");
            // User paused — stop any pending stream reconnects
            this._cancelReconnect();
            // Just update state — progress keeps ticking (radio server-side)
            // and metadata stays as-is in the notification.
            this._emitState();
          } catch (error) {
            console.error("[PlayerService] Pause error:", error);
          }
        }
      },

      async changeStream(stream: Stream): Promise<void> {
        if (this._currentStream.id !== stream.id) {
          this._currentStream = stream;
          await AsyncStorage.setItem("currentStream", JSON.stringify(stream));

          // If the player is active, swap the stream without destroying
          // the media session — just replace the audio source.
          if (await this.isPlayerSetup()) {
            const wasPlaying = !this._paused;
            const source = buildStreamSource(stream.url);

            if (this.player) {
              this.player.replace(source);
            } else {
              this.player = createAudioPlayer(source, {
                updateInterval: PLAYER_TICK_INTERVAL_MS,
              });
              this._attachStatusListener();
            }

            if (wasPlaying) {
              this.player.play();
              this._paused = false;
            }

            // Fetch fresh data for the new stream
            await this.refreshData();
            await this.updateMetadata();
          }

          this._emitState();
        }
      },

      async openPedidosURL(): Promise<void> {
        await openBrowserAsync(API.PEDIDOS_URL);
      },

      async updateMetadata(): Promise<void> {
        try {
          const newMetadata = this.getNowPlayingMetadata();
          const titleKey = `${newMetadata.title}|${newMetadata.artist}`;
          if (this._lastMetadataTitle !== titleKey) {
            this._lastMetadataTitle = titleKey;
          }
          setNowPlayingMetadata(newMetadata);
          setRemotePlaybackStatus(
            this._paused ? "paused" : "playing",
            toSec(getTrackProgress(this._currentTrack ?? undefined)),
          );
        } catch (error) {
          console.error("[PlayerService] Metadata update error:", error);
        }
      },

      async updateNowPlayingProgress(): Promise<void> {
        // Progress is now handled by _tickProgress which periodically
        // pushes updateNowPlayingMetadata to the native media session.
        // This method is kept for API compatibility.
        if (!this._currentTrack) return;
        if (!this._showMediaProgress) return;

        const elapsed = getTrackProgress(this._currentTrack);
        if (elapsed == null) {
          this._showMediaProgress = false;
          this._nativeProgressTickCount = 0;
          try {
            if (await this.isPlayerSetup()) {
              const cleanMeta = this.getNowPlayingMetadata();
              setNowPlayingMetadata(cleanMeta);
              setRemotePlaybackStatus(this._paused ? "paused" : "playing", 0);
            }
          } catch {
            // best-effort
          }
        }
      },

      async refreshHistory(typeHistory: HistoryType): Promise<void> {
        if (!this._lastRequestedTracks) {
          this._lastRequestedTracks = [];
        }
        if (!this._lastPlayedTracks) {
          this._lastPlayedTracks = [];
        }

        try {
          const tracks = await animuService.getTrackHistory(typeHistory);
          if (!tracks || tracks.length === 0) return;

          const targetArray =
            typeHistory === "requests"
              ? this._lastRequestedTracks
              : this._lastPlayedTracks;

          for (const track of tracks) {
            if (!targetArray.find((t) => t.raw === track.raw)) {
              targetArray.unshift(track);
            } else if (
              Date.now() - track.startTime.getTime() >
              24 * 60 * 60 * 1000
            ) {
              break;
            }
          }

          this._emitState();
        } catch (error) {
          console.error(
            `[PlayerService] Error refreshing ${typeHistory} history:`,
            error,
          );
        }
      },

      async destroy(): Promise<void> {
        if (!(await this.isPlayerSetup())) {
          return;
        }

        try {
          this._statusListener?.remove();
          this._statusListener = null;
          this._cancelReconnect();
          this._networkUnsubscribe?.();
          this._networkUnsubscribe = null;
          this._wasConnected = null;
          this._reconnectAttempts = 0;
          this._streamStarted = false;
          this.player?.remove();
          this.player = null;
          await EndPlaybackSession();

          this._cancelScheduledRefresh();
          this._consecutiveErrors = 0;
          this._paused = true;
          this._currentStream = CONFIG.DEFAULT_STREAM_OPTION;
          this._currentTrack = null;
          this._currentProgram = null;
          this._listeners = null;
          this._showMediaProgress = false;
          this._nativeProgressTickCount = 0;
          this._nativeSetupDone = false;
          this._isInitialized = false;

          this._emitState();
          this._emitProgress();

          playerServiceInstance = null;
        } catch (error) {
          console.error("[PlayerService] Destruction failed:", error);
        }
      },
    };
  }

  return playerServiceInstance;
};
