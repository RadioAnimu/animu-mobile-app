import type { AudioStatus } from "expo-audio";
import type { NowPlayingMetadata } from "react-native-playback-controls";
import NetInfo from "@react-native-community/netinfo";
import { openBrowserAsync } from "expo-web-browser";
import type { HistoryType } from "./../../@types/history-type.d";
import type { Stream } from "../domain/stream";
import { getTrackProgress } from "../domain/track";
import { animuService } from "../services/animu.service";
import { userSettingsService } from "../services/user-settings.service";
import { EndPlaybackSession } from "../services/player-playback.service";
import { API } from "../../api";
import { animuApi } from "../../api/client";
import { CONFIG } from "../../utils/player.config";
import { BackoffScheduler } from "./backoff";
import {
  buildNowPlayingMetadata,
  type NowPlayingInput,
} from "./now-playing.metadata";
import { MediaSessionPublisher } from "./media-session.publisher";
import {
  NetworkMonitor,
  type ConnectivitySubscribe,
} from "./network-monitor";
import {
  NowPlayingRepository,
} from "./now-playing.repository";
import { ProgressTicker, toSec } from "./progress-ticker";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type StationSnapshot,
} from "./store";
import { StreamPreferences } from "./stream-preferences";
import { AudioTransport } from "./transport";
import { TransportStateMachine } from "./transport-state";
import { jsTimer } from "./timer";

// ── Stream reconnect backoff ──
/** Base delay between stream reconnect attempts (ms) — doubles each retry */
const BASE_RECONNECT_DELAY_MS = 2000;
/** Max delay between stream reconnect attempts (ms) */
const MAX_RECONNECT_DELAY_MS = 30_000;
/**
 * Grace period after a transport transition before an idle/failed native
 * status is treated as a dead stream. Filters transient native states:
 * e.g. replace() emits a brief ExoPlayer "idle" before play() starts
 * buffering. Real stream deaths (ExoPlayer retry exhaustion, AVPlayer
 * .failed) always arrive after their internal retry windows.
 */
const STREAM_DEATH_GRACE_MS = 3000;
/**
 * Minimum spacing between processed progress ticks (ms). The heartbeat
 * has two drivers — native `playbackStatusUpdate` events (playing) and
 * the JS "track-progress" task (paused foreground) — both call
 * `tickProgress()`; this gate collapses them to ≤1 Hz.
 */
const HEARTBEAT_MIN_INTERVAL_MS = 800;
/**
 * Data-refresh cadence while PLAYING, driven by native heartbeats (one
 * poll every N seconds of audio). Native events keep arriving while the
 * app is backgrounded (foreground service on Android, background audio
 * on iOS) — JS timers don't — so this is what keeps the media session's
 * title/cover updating on live shows in the background.
 */
const PLAY_HEARTBEATS_PER_POLL = 5;

export interface PlayerServiceDependencies {
  state: TransportStateMachine;
  transport: AudioTransport;
  publisher: MediaSessionPublisher;
  repository: NowPlayingRepository;
  streamPreferences: StreamPreferences;
  reconnect: BackoffScheduler;
  networkMonitor: NetworkMonitor;
  ticker: ProgressTicker;
}

/**
 * Thin orchestrator over small, focused units:
 *
 * - `AudioTransport`       — native player + audio session lifecycle
 * - `TransportStateMachine`— explicit play-intent lifecycle
 * - `BackoffScheduler`     — exponential reconnect timer
 * - `NowPlayingRepository` — on-air data: fetch, diff, retry, track-end
 * - `MediaSessionPublisher`— pushes metadata/status to the OS
 * - `ProgressTicker`       — 1 Hz progress heartbeat
 * - `StreamPreferences`    — persisted stream choice
 * - `NetworkMonitor`       — offline → online transitions
 *
 * The orchestrator owns no playback or data logic of its own: it reacts
 * to events (native status, network, ticks) and routes them between the
 * units, and is the single writer of the React stores.
 */
export class PlayerService {
  private streamOptions: Stream[] = [];
  private initialized = false;
  /** In-flight bootstrap — dedupes concurrent `setupPlayer()` calls. */
  private setupPromise: Promise<void> | null = null;
  /** One-way: a destroyed instance must never touch stores/native again. */
  private disposed = false;
  /** Date.now() of the last processed progress tick (heartbeat gate). */
  private lastHeartbeatAt = 0;
  /** Processed heartbeats since the last heartbeat-driven data poll. */
  private heartbeats = 0;
  /** Total processed heartbeats — drives the sampled status log. */
  private heartbeatSamples = 0;

  constructor(private readonly deps: PlayerServiceDependencies) {
    // ── Wiring: this class owns every cross-unit connection ──
    this.deps.transport.setStatusHandler((status) =>
      this.handlePlaybackStatus(status),
    );
    this.deps.repository.onChange = (change) => {
      // Route by change cadence: track/program → now-playing UI,
      // listeners/histories → poll-data UI. A listener-count tick never
      // re-renders the now-playing UI and vice versa.
      if (change.trackChanged || change.programChanged) this.emitPlayer();
      if (
        change.listenersChanged ||
        change.playedChanged ||
        change.requestedChanged
      ) {
        this.emitStation();
      }
    };
    this.deps.networkMonitor.onRestore = () => this.handleNetworkRestore();
  }

  // ── Queries ──

  /** Whether the user's last action was "play" (covers the intent chain). */
  get isPlayingIntent(): boolean {
    return this.deps.state.isPlayingIntent;
  }

  /**
   * Whether audio can actually be driven: native session done, player
   * created and a track is on air. (Replaces the old async isPlayerSetup.)
   */
  get isReady(): boolean {
    return (
      this.deps.transport.isSessionReady &&
      this.deps.transport.hasPlayer &&
      this.deps.repository.hasTrack
    );
  }

  getNowPlayingMetadata(): NowPlayingMetadata {
    return buildNowPlayingMetadata(this.nowPlayingInput());
  }

  // ── Lifecycle ──

  /**
   * Single entry-point that bootstraps everything the player needs:
   * streams from API, stored stream preference, native TrackPlayer,
   * first data fetch, and media session preload.
   *
   * Idempotent: concurrent calls (remount racing an in-flight bootstrap,
   * StrictMode double-mount) share one bootstrap instead of double-running
   * the native session setup.
   */
  async setupPlayer(): Promise<void> {
    if (this.setupPromise) return this.setupPromise;
    if (this.initialized) return;

    this.setupPromise = this.runSetup().finally(() => {
      this.setupPromise = null;
    });
    return this.setupPromise;
  }

  private async runSetup(): Promise<void> {
    // ── Phase 1: fire EVERYTHING that has no interdependencies ──
    // Streams, native TrackPlayer, and user settings resolve
    // independently — run them all at once.
    const [streams] = await Promise.all([
      animuApi.getStreams(),
      this.deps.transport.ensureSession(),
      userSettingsService.initialize(), // pre-warm cache
    ]);
    // Destroyed while bootstrapping (e.g. unmount mid-setup) — bail
    // before touching any state or store.
    if (this.disposed) return;
    this.streamOptions = streams;

    // Watch connectivity: instant reconnect + data refresh when back online
    this.deps.networkMonitor.start();

    // Resolve the user's preferred stream (or default to first)
    await this.deps.streamPreferences.load(streams);
    if (this.disposed) return;

    // ── Phase 2: first data fetch (needs stream + settings ready) ──
    try {
      await this.refreshData();
    } catch (err) {
      console.warn(
        "[PlayerService] setupPlayer: initial data fetch failed:",
        err,
      );
    }
    if (this.disposed) return;

    // Mark initialized ASAP — UI can render now
    this.initialized = true;
    this.emitPlayer();
    this.emitProgress();

    // ── Phase 3: media session preload (non-blocking) ──
    // Fire-and-forget: the notification player is nice-to-have,
    // the UI is already interactive.
    if (this.deps.repository.hasTrack && this.deps.transport.isSessionReady) {
      this.deps.publisher.push(
        this.getNowPlayingMetadata(),
        this.deps.state.remoteStatus,
      );
    }
  }

  /**
   * Tears the player down. Safe to call from any lifecycle stage: a
   * half-set-up instance (unmount during bootstrap) still gets its
   * timers, monitor, transport and singleton released — a destroyed
   * instance can never keep polling or writing stores in the background.
   */
  async destroy(): Promise<void> {
    this.disposed = true;
    this.setupPromise = null;

    if (!this.isReady) {
      // Half-set-up or already destroyed: release whatever exists.
      this.deps.repository.dispose();
      this.deps.reconnect.reset();
      this.deps.networkMonitor.stop();
      this.heartbeats = 0;
      this.lastHeartbeatAt = 0;
      this.heartbeatSamples = 0;
      if (this.deps.transport.hasPlayer) {
        this.deps.transport.dispose();
        this.deps.transport.markSessionDown();
      }
      await EndPlaybackSession().catch(() => {});
      this.deps.state.transition("idle");
      this.initialized = false;
      this.emitPlayer();
      resetPlayerServiceSingleton();
      return;
    }

    try {
      this.deps.transport.dispose();
      this.deps.reconnect.reset();
      this.deps.networkMonitor.stop();
      await EndPlaybackSession();

      this.deps.repository.dispose();
      this.deps.state.transition("idle");
      this.deps.streamPreferences.reset();
      this.deps.repository.clear();
      this.deps.ticker.reset();
      this.deps.transport.markSessionDown();
      this.initialized = false;
      this.streamOptions = [];
      this.heartbeats = 0;
      this.lastHeartbeatAt = 0;
      this.heartbeatSamples = 0;

      this.emitPlayer();
      this.emitStation();
      this.emitProgress();
    } catch (error) {
      console.error("[PlayerService] Destruction failed:", error);
    } finally {
      // Always release — a failed teardown must not leave this instance
      // as the app-wide singleton.
      resetPlayerServiceSingleton();
    }
  }

  // ── Playback commands ──

  async play(): Promise<void> {
    try {
      // Ensure audio mode + media session are set up, then resolve the
      // stored stream (setupPlayer already persisted a valid default).
      if (!this.deps.transport.isSessionReady) {
        await this.deps.transport.ensureSession();
        await this.deps.streamPreferences.restore(this.streamOptions);
      }

      // Fresh playback session: clear any reconnect state
      this.deps.reconnect.reset();
      // …and restart the heartbeat cadence (first native tick processes
      // immediately; the poll cycle counts from zero)
      this.heartbeats = 0;
      this.lastHeartbeatAt = 0;
      this.heartbeatSamples = 0;

      this.deps.transport.play(this.deps.streamPreferences.current.url);
      this.deps.state.transition("connecting");

      // Fetch fresh data + push metadata in one go
      await this.refreshData();
      await this.updateMetadata();
    } catch (error) {
      console.error("[PlayerService] Playback error:", error);
      throw error;
    } finally {
      this.emitPlayer();
      this.emitProgress();
    }
  }

  async pause(): Promise<void> {
    // Pausing only needs the audio transport — a failed/slow now-playing
    // fetch must never make the audio unpausable.
    if (
      !this.deps.transport.isSessionReady ||
      !this.deps.transport.hasPlayer ||
      this.deps.state.state === "paused"
    ) {
      return;
    }

    try {
      // User paused — stop any pending stream reconnects first
      this.deps.reconnect.cancel();

      this.deps.transport.pause();
      this.deps.state.transition("paused");
      this.deps.publisher.pushStatus("paused");
      // Just update state — progress keeps ticking (radio server-side)
      // and metadata stays as-is in the notification.
    } catch (error) {
      console.error("[PlayerService] Pause error:", error);
    } finally {
      // The state machine no longer emits (orchestrator is the single
      // store writer) — flipping isPlayingIntent → false must reach the
      // UI or the play/pause button latches (old _setState emitted here).
      this.emitPlayer();
    }
  }

  async changeStream(stream: Stream): Promise<void> {
    if (this.deps.streamPreferences.current.id === stream.id) return;

    await this.deps.streamPreferences.set(stream);

    // If the audio transport exists, swap the stream without destroying
    // the media session — just replace the audio source. (Deliberately
    // not `isReady`: a missing track snapshot must not leave the audio
    // playing the OLD stream while the store already records the new one.)
    if (this.deps.transport.hasPlayer) {
      const wasPlaying = this.deps.state.isPlayingIntent;

      // A pending reconnect would double-fire after the manual re-tune
      this.deps.reconnect.cancel();

      this.deps.transport.load(stream.url);
      if (wasPlaying) {
        this.deps.transport.resume();
        this.deps.state.transition("connecting");
      }

      // Fetch fresh data for the new stream
      await this.refreshData();
      await this.updateMetadata();
    }

    this.emitPlayer();
  }

  // ── Data ──

  async refreshData(): Promise<boolean> {
    const changed = await this.deps.repository.refresh();
    if (changed && this.isReady) {
      console.info(
        `[PlayerService] track/program changed → updating media session: ${
          this.deps.repository.currentTrack?.title ?? "?"
        }`,
      );
      await this.updateMetadata();
    }
    return changed;
  }

  async refreshHistory(type: HistoryType): Promise<void> {
    await this.deps.repository.refreshHistory(type);
  }

  async updateMetadata(): Promise<void> {
    try {
      this.deps.publisher.push(
        this.getNowPlayingMetadata(),
        this.deps.state.remoteStatus,
        toSec(getTrackProgress(this.deps.repository.currentTrack ?? undefined)),
      );
    } catch (error) {
      console.error("[PlayerService] Metadata update error:", error);
    }
  }

  /**
   * 1 Hz heartbeat — see `ProgressTicker`. Gates the two drivers (native
   * status events while playing, the JS task otherwise) into at-most-one
   * processed tick per second. Returns whether the tick was processed.
   */
  tickProgress(): boolean {
    const now = Date.now();
    if (now - this.lastHeartbeatAt < HEARTBEAT_MIN_INTERVAL_MS) return false;
    this.lastHeartbeatAt = now;
    // Watchdog: expires a data refresh latched past its hard limit. In the
    // background a stalled fetch's JS-timer abort never fires, so without
    // this the repository (and the media session with it) freezes on an
    // old track forever. Native heartbeats keep ticking where JS timers
    // don't — see REFRESH_STALE_MS.
    this.deps.repository.expireStuckRefresh();
    this.deps.ticker.tick();
    return true;
  }

  async openPedidosURL(): Promise<void> {
    await openBrowserAsync(API.PEDIDOS_URL);
  }

  // ── Event handlers (wired in the constructor) ──

  /**
   * Native playback status handler. Drives reconnect detection:
   * Android surfaces a dead stream as playbackState "idle" (ExoPlayer
   * exhausts its internal retries and stops — expo-audio never retries),
   * iOS as "failed" (AVPlayer .failed status).
   */
  private handlePlaybackStatus(status: AudioStatus): void {
    // Straggler native event after teardown — a destroyed instance must
    // not tick, poll or transition.
    if (this.disposed) return;

    // Stream is actually producing audio — resets the backoff chain
    if (status.playing) {
      this.deps.reconnect.reset();
      this.deps.state.transition("playing");

      // Native 1 Hz heartbeat: drives progress + media-session pushes AND
      // the data poll while playing. These events keep arriving while the
      // app is backgrounded, where JS timers freeze/throttle — without
      // this, a live show's notification keeps a stale title/cover forever.
      if (this.tickProgress()) {
        this.heartbeats++;
        this.heartbeatSamples++;
        // Sampled: proves native status events still reach JS while
        // backgrounded (JS timers freeze there) — one line every ~30s.
        if (this.heartbeatSamples % 30 === 0) {
          console.info(
            `[PlayerService] heartbeat ok (state=${this.deps.state.state})`,
          );
        }
        if (this.heartbeats >= PLAY_HEARTBEATS_PER_POLL) {
          this.heartbeats = 0;
          void this.refreshData().catch(console.error);
        }
      }
      return;
    }

    // Stream died while the user wants playback → schedule reconnect.
    // The grace window filters transient native idle states (replace()).
    const streamLost =
      this.deps.state.isPlayingIntent &&
      !status.isBuffering &&
      (status.playbackState === "idle" ||
        status.playbackState === "failed") &&
      Date.now() - this.deps.state.enteredAt > STREAM_DEATH_GRACE_MS;

    if (streamLost) {
      this.scheduleReconnect();
    }
  }

  private handleNetworkRestore(): void {
    if (this.disposed) return;

    // Instant reconnect instead of waiting the backoff out
    this.deps.reconnect.reset();

    if (this.deps.state.isPlayingIntent) {
      void this.attemptReconnect();
    }

    // Refresh all API data (track, program, listeners, history)
    this.refreshData().catch(console.error);
  }

  // ── Reconnect chain ──

  private scheduleReconnect(): void {
    if (this.deps.reconnect.isPending) return;

    this.deps.state.transition("reconnecting");

    // Exponential backoff: 2s → 4s → 8s → 16s → 30s (cap)
    const delay = this.deps.reconnect.schedule(() => {
      void this.attemptReconnect().catch(console.error);
    });

    console.warn(
      `[PlayerService] Stream lost — reconnecting in ${delay}ms (attempt ${this.deps.reconnect.attemptCount})`,
    );
  }

  /**
   * Reconnects to the live stream: replaces the audio source (which
   * re-opens the connection at the current live point — there is no
   * gapless resume on a radio stream) and resumes playback.
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.deps.state.isPlayingIntent || !this.deps.transport.hasPlayer) {
      return;
    }

    try {
      this.deps.transport.play(this.deps.streamPreferences.current.url);
      this.deps.state.transition("connecting");
      this.deps.publisher.pushStatus(this.deps.state.remoteStatus);
    } catch (error) {
      console.error("[PlayerService] Reconnect attempt failed:", error);
      this.scheduleReconnect();
    }
  }

  // ── Store emission (single writer) ──

  private nowPlayingInput(): NowPlayingInput {
    return {
      track: this.deps.repository.currentTrack,
      isLive: this.deps.repository.currentProgram?.isLive ?? false,
      showProgress: this.deps.repository.showProgress,
      defaultCover: CONFIG.DEFAULT_COVER,
    };
  }

  /** Now-playing snapshot — per song / program / stream / user action. */
  private emitPlayer(): void {
    const next: PlayerSnapshot = {
      currentTrack: this.deps.repository.currentTrack ?? undefined,
      currentProgram: this.deps.repository.currentProgram ?? undefined,
      currentStream: this.deps.streamPreferences.current,
      streamOptions: this.streamOptions,
      isPlaying: this.isPlayingIntent,
      isInitialized: this.initialized,
    };
    playerStore.setSnapshot(next);
  }

  /** Poll-data snapshot — listeners + histories. */
  private emitStation(): void {
    const next: StationSnapshot = {
      currentListeners: this.deps.repository.listeners ?? undefined,
      lastPlayedTracks: this.deps.repository.lastPlayedTracks.length
        ? this.deps.repository.lastPlayedTracks
        : undefined,
      lastRequestedTracks: this.deps.repository.lastRequestedTracks.length
        ? this.deps.repository.lastRequestedTracks
        : undefined,
    };
    stationStore.setSnapshot(next);
  }

  private emitProgress(): void {
    progressStore.setSnapshot({
      currentTrackProgress: getTrackProgress(
        this.deps.repository.currentTrack ?? undefined,
      ),
      showProgress: this.deps.repository.showProgress,
    });
  }
}

// ─── Singleton factory ───

const netInfoSubscribe: ConnectivitySubscribe = (handler) =>
  NetInfo.addEventListener((state) => handler({ isConnected: state.isConnected }));

let playerServiceInstance: PlayerService | null = null;

/** Builds a fully-wired PlayerService with production dependencies. */
export const createPlayerService = (): PlayerService => {
  const state = new TransportStateMachine();
  const transport = new AudioTransport();
  const publisher = new MediaSessionPublisher();
  const streamPreferences = new StreamPreferences();
  const reconnect = new BackoffScheduler({
    baseMs: BASE_RECONNECT_DELAY_MS,
    maxMs: MAX_RECONNECT_DELAY_MS,
    timer: jsTimer,
    label: "stream-reconnect",
  });
  const repository = new NowPlayingRepository({
    fetchers: animuService,
    getCoverQuality: () =>
      userSettingsService.getCurrentSettings().liveQualityCover,
    timer: jsTimer,
  });
  const networkMonitor = new NetworkMonitor(netInfoSubscribe);
  const ticker = new ProgressTicker({
    repository,
    state,
    transport,
    publisher,
    buildMetadata: () =>
      buildNowPlayingMetadata({
        track: repository.currentTrack,
        isLive: repository.currentProgram?.isLive ?? false,
        showProgress: repository.showProgress,
        defaultCover: CONFIG.DEFAULT_COVER,
      }),
  });

  return new PlayerService({
    state,
    transport,
    publisher,
    repository,
    streamPreferences,
    reconnect,
    networkMonitor,
    ticker,
  });
};

const resetPlayerServiceSingleton = (): void => {
  playerServiceInstance = null;
};

/** App-wide singleton — recreated after `destroy()` (e.g. remounts). */
export const playerService = (): PlayerService => {
  if (!playerServiceInstance) {
    playerServiceInstance = createPlayerService();
  }
  return playerServiceInstance;
};
