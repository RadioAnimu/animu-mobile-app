import { HistoryType } from "./../../@types/history-type.d";
import TrackPlayer, { NowPlayingMetadata } from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openBrowserAsync } from "expo-web-browser";
import { Platform } from "react-native";
import BackgroundTimer from "react-native-background-timer";
import { Stream } from "../domain/stream";
import { getTrackProgress, Track } from "../domain/track";
import { Program } from "../domain/program";
import { Listeners } from "../domain/listeners";
import { animuService } from "../services/animu.service";
import { CONFIG } from "../../utils/player.config";
import { API } from "../../api";
import { userSettingsService } from "./user-settings.service";
import { SetupService } from "./player-setup.service";
import { PlayerSnapshot, playerStore, progressStore } from "./player-store";
import { fetchStreams } from "../../data/http/animu-streams.api";

// ── Platform-safe one-shot timers (Android needs BackgroundTimer) ──
const _setTimeout = (fn: () => void, ms: number): number => {
  if (Platform.OS === "android") {
    return BackgroundTimer.setTimeout(fn, ms);
  }
  return setTimeout(fn, ms) as unknown as number;
};

const _clearTimeout = (id: number | null): void => {
  if (id == null) return;
  if (Platform.OS === "android") {
    BackgroundTimer.clearTimeout(id);
  } else {
    clearTimeout(id as unknown as NodeJS.Timeout);
  }
};

/** Buffer after expected track end before fetching (ms) */
const TRACK_END_BUFFER_MS = 500;
/** Max backoff delay on consecutive network errors (ms) */
const MAX_RETRY_DELAY_MS = 30_000;
/** Base retry delay (ms) — doubles each consecutive error */
const BASE_RETRY_DELAY_MS = 2_000;

export interface PlayerServiceProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
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
  /** Whether the native TrackPlayer.setupPlayer() has been called */
  _nativeSetupDone: boolean;
  /** Whether to show real progress in the media session notification */
  _showMediaProgress: boolean;
  /** Counter for throttling native metadata pushes in _tickProgress */
  _nativeProgressTickCount: number;
  _isInitialized: boolean;
  /** Timeout ID for the one-shot track-end refresh */
  _trackEndTimeoutId: number | null;
  /** Timeout ID for exponential-backoff retry on network errors */
  _retryTimeoutId: number | null;
  /** Consecutive network errors (reset on success) — drives backoff */
  _consecutiveErrors: number;
  isPlayerSetup: () => Promise<boolean>;
  _isRealTrack: (track: Track) => boolean;
  /** Schedule a one-shot refresh at the expected track-end time */
  _scheduleTrackEndRefresh: () => void;
  /** Cancel any pending track-end or retry timers */
  _cancelScheduledRefresh: () => void;
  /** Schedule an exponential-backoff retry after a network error */
  _scheduleRetry: () => void;
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
      player: TrackPlayer,
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
      _consecutiveErrors: 0,

      _isRefreshing: false,

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
            console.log(
              "[PlayerService] Track already ended, refreshing now...",
            );
            this.refreshData().catch(console.error);
          }, 1000);
          return;
        }

        const delay = msUntilEnd + TRACK_END_BUFFER_MS;
        console.log(
          "[PlayerService] Track-end refresh scheduled in",
          Math.round(delay / 1000) + "s",
        );

        this._trackEndTimeoutId = _setTimeout(() => {
          this._trackEndTimeoutId = null;
          console.log("[PlayerService] Track-end timer fired, refreshing...");
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

        console.log(
          "[PlayerService] Scheduling retry in",
          Math.round(delay / 1000) + "s",
          "(attempt",
          this._consecutiveErrors + ")",
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
        console.log("[PlayerService] setupPlayer: starting bootstrap...");

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
          console.log(
            "[PlayerService] First-time stream defaulted to:",
            this._currentStream.id,
            this._currentStream.url,
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

        console.log("[PlayerService] setupPlayer: bootstrap complete.");
      },

      /** Fire-and-forget media session preload */
      async _preloadMediaSession(): Promise<void> {
        const metadata = this.getNowPlayingMetadata();
        await TrackPlayer.add({
          id: "1",
          url: this._currentStream.url,
          userAgent: CONFIG.USER_AGENT,
          title: metadata.title,
          artist: metadata.artist,
          artwork: metadata.artwork,
        });
        await this.updateMetadata();
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
          console.log(
            "[PlayerService] tickProgress: track ended, clearing progress",
          );
          this._showMediaProgress = false;
          this._nativeProgressTickCount = 0;
          progressStore.setSnapshot({
            currentTrackProgress: null,
            showProgress: false,
          });
          try {
            if (this._nativeSetupDone) {
              const cleanMeta = this.getNowPlayingMetadata();
              await this.player.updateNowPlayingMetadata(cleanMeta);
            }
          } catch {
            // best-effort
          }
          return;
        }

        // Periodically push elapsed time to the native media session.
        // iOS: re-asserts elapsedPlaybackTime to counteract AVPlayer auto-updates.
        // Android: the native patch reads elapsedTime from this metadata and
        //          sets PlaybackState position directly on the MediaSession.
        // Push every ~3 ticks (3 seconds at 1s interval).
        this._nativeProgressTickCount++;
        if (this._nativeProgressTickCount >= 3) {
          this._nativeProgressTickCount = 0;
          if (this._nativeSetupDone && (await this.isPlayerSetup())) {
            try {
              const meta = this.getNowPlayingMetadata();
              await this.player.updateNowPlayingMetadata(meta);
            } catch {
              // best-effort
            }
          }
        }
      },

      async isPlayerSetup(): Promise<boolean> {
        // Fast path — if native setup never completed, skip bridge calls
        if (!this._nativeSetupDone || !this._currentTrack) return false;

        try {
          const activeTrack = await TrackPlayer.getActiveTrack();
          return !!activeTrack;
        } catch {
          return false;
        }
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
            console.log(
              "[PlayerService] Track changed:",
              newTrack.raw,
              "| isLive:",
              newProgram.isLive,
            );

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
              console.log(
                "[PlayerService] refreshData: track progress ON | elapsed:",
                elapsed != null ? Math.round(elapsed / 1000) + "s" : "null",
                "| duration:",
                Math.round(newTrack.duration / 1000) + "s",
              );
            } else {
              this._showMediaProgress = false;
              console.log(
                "[PlayerService] refreshData: progress OFF | isReal:",
                this._isRealTrack(newTrack),
                "| isLive:",
                newProgram.isLive,
              );
            }
          }

          if (
            this._currentProgram?.name !== newProgram.name ||
            this._currentProgram?.dj !== newProgram.dj ||
            this._currentProgram?.isLive !== newProgram.isLive
          ) {
            console.log(
              "[PlayerService] Program changed:",
              newProgram.name,
              "| dj:",
              newProgram.dj,
              "| isLive:",
              newProgram.isLive,
            );
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

            // Android: the native RNTP patch now handles position via
            // PlaybackState set from elapsedTime in updateNowPlayingMetadata.
            // No seekTo needed — it causes stream reconnection on ICY streams.
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
        const baseMetadata = this._currentTrack?.metadata || {
          title: "N/A",
          artist: "N/A",
          date: "N/A",
          genre: "N/A",
          description: "N/A",
          duration: 0,
          artwork: CONFIG.DEFAULT_COVER,
        };

        const isLive = this._currentProgram?.isLive ?? false;

        // Show REAL elapsed/duration from the track data
        if (this._showMediaProgress && this._currentTrack) {
          const elapsed = getTrackProgress(this._currentTrack);
          if (elapsed != null) {
            const durationSec = this._currentTrack.duration / 1000;
            const elapsedSec = elapsed / 1000;
            return {
              ...baseMetadata,
              duration: durationSec,
              elapsedTime: elapsedSec,
              isLiveStream: isLive,
            };
          }
        }

        // No progress: send 0/0 so the bar is empty/hidden
        return {
          ...baseMetadata,
          duration: 0,
          elapsedTime: 0,
          isLiveStream: isLive,
        };
      },

      async play(): Promise<void> {
        console.log("[PlayerService] Play requested.");

        // Ensure native player is set up
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
          await TrackPlayer.reset();

          const metadata = this.getNowPlayingMetadata();
          await TrackPlayer.add({
            id: "1",
            url: this._currentStream.url,
            userAgent: CONFIG.USER_AGENT,
            title: metadata.title,
            artist: metadata.artist,
            artwork: metadata.artwork,
          });

          await TrackPlayer.play();
          this._paused = false;

          // Fetch fresh data + push metadata in one go
          await this.refreshData();

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
            await TrackPlayer.pause();
            this._paused = true;
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
          // the media session — just reset + re-add with the new URL.
          if (await this.isPlayerSetup()) {
            const wasPlaying = !this._paused;
            await TrackPlayer.reset();

            const metadata = this.getNowPlayingMetadata();
            await TrackPlayer.add({
              id: "1",
              url: stream.url,
              userAgent: CONFIG.USER_AGENT,
              title: metadata.title,
              artist: metadata.artist,
              artwork: metadata.artwork,
            });

            if (wasPlaying) {
              await TrackPlayer.play();
              this._paused = false;
            }

            // Fetch fresh data for the new stream
            await this.refreshData();
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
            console.log(
              "[PlayerService] 🎵 Updating metadata:",
              newMetadata.title,
              "-",
              newMetadata.artist,
            );
            this._lastMetadataTitle = titleKey;
          }
          await this.player.updateNowPlayingMetadata(newMetadata);
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
          console.log(
            "[PlayerService] updateProgress: track ended, clearing progress",
          );
          this._showMediaProgress = false;
          this._nativeProgressTickCount = 0;
          try {
            if (await this.isPlayerSetup()) {
              const cleanMeta = this.getNowPlayingMetadata();
              await this.player.updateNowPlayingMetadata(cleanMeta);
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
          await this.player.stop();
          await this.player.reset();

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
