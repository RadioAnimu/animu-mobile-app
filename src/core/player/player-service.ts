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
import { ArtworkResolver } from "./artwork";
import { HeartbeatScheduler } from "./heartbeat";
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
import {
  TransportStateMachine,
  type TransportState,
} from "./transport-state";
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

export interface PlayerServiceDependencies {
  state: TransportStateMachine;
  transport: AudioTransport;
  publisher: MediaSessionPublisher;
  repository: NowPlayingRepository;
  streamPreferences: StreamPreferences;
  reconnect: BackoffScheduler;
  networkMonitor: NetworkMonitor;
  ticker: ProgressTicker;
  heartbeat: HeartbeatScheduler;
  artwork: ArtworkResolver;
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
 * - `HeartbeatScheduler`   — 1 Hz gate + watchdog + data-poll cadence
 * - `ArtworkResolver`      — local-file artwork + bundled default cover
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
    this.deps.heartbeat.onPoll = () => {
      void this.refreshData().catch(console.error);
    };
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
    // Streams, native TrackPlayer, user settings, and the bundled default
    // cover resolve independently — run them all at once.
    const [streams] = await Promise.all([
      animuApi.getStreams(),
      this.deps.transport.ensureSession(),
      userSettingsService.initialize(), // pre-warm cache
      this.deps.artwork.init(), // pre-warm the local default cover
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
      this.deps.heartbeat.reset();
      this.deps.artwork.reset();
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
      this.deps.heartbeat.reset();
      this.deps.artwork.reset();
      this.deps.transport.markSessionDown();
      this.initialized = false;
      this.streamOptions = [];

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
      this.deps.heartbeat.reset();

      this.deps.transport.play(this.deps.streamPreferences.current.url);
      // Reconcile emits the store (isPlaying → true immediately) and
      // pushes "buffering" to the media session.
      this.reconcile("connecting");

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
      // Reconcile flips isPlayingIntent → false, emits the store and
      // pushes "paused" to the media session (the old flow pushed the
      // status manually and could leave the button latched).
      this.reconcile("paused");
      // Progress keeps ticking (radio plays server-side) and metadata
      // stays as-is in the notification.
    } catch (error) {
      console.error("[PlayerService] Pause error:", error);
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
        // Reconcile: the notification follows the re-tune ("buffering")
        // instead of claiming the old stream is still playing.
        this.reconcile("connecting");
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
      if (CONFIG.DEBUG) {
        console.info(
          `[PlayerService] track/program changed → updating media session: ${
            this.deps.repository.currentTrack?.title ?? "?"
          }`,
        );
      }
      await this.updateMetadata();
    }
    return changed;
  }

  async refreshHistory(type: HistoryType): Promise<void> {
    await this.deps.repository.refreshHistory(type);
  }

  async updateMetadata(): Promise<void> {
    try {
      // Download the cover to a local file so the media session's native
      // loader (no UA, no retry) renders it reliably. The first push uses
      // the remote URL as-is; when the local file lands, push again so
      // the notification swaps to the file URI within seconds. Skipped
      // when the song changed mid-download — that push owns the session.
      const artworkUrl = this.deps.repository.currentTrack?.artwork;
      if (artworkUrl && !this.deps.artwork.peek(artworkUrl)) {
        void this.deps.artwork.resolve(artworkUrl).then(() => {
          if (this.deps.repository.currentTrack?.artwork === artworkUrl) {
            this.updateMetadata();
          }
        });
      }

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
   * JS fallback driver for the 1 Hz heartbeat (see `HeartbeatScheduler`):
   * covers paused-in-foreground — where native status events go silent but
   * the radio keeps playing server-side — plus a foreground safety net
   * while playing. While backgrounded, the NATIVE driver
   * (`playbackStatusUpdate`) beats into the same scheduler, where JS
   * timers freeze/throttle.
   */
  heartbeat(): void {
    this.deps.heartbeat.beat();
  }

  async openPedidosURL(): Promise<void> {
    await openBrowserAsync(API.PEDIDOS_URL);
  }

  // ── Event handlers (wired in the constructor) ──

  /**
   * Reconciles a transport state across every surface: the state machine,
   * the React stores and the media session. This is the fix for the
   * "reconnection messes with state" class of bugs — transitions used to
   * be silent (no emit, no status push), so the notification stayed on
   * "buffering" after a live-stream reconnect and the app button could
   * disagree with reality until the next track change.
   *
   * Refused transitions (e.g. the state machine guarding a race) emit and
   * push nothing.
   */
  private reconcile(next: TransportState): void {
    if (!this.deps.state.transition(next)) return;
    // Any state change is UI-visible: isPlaying and playbackState derive
    // from the state machine.
    this.emitPlayer();
    // …and it changes the media session's affordance (play/pause/loading
    // icon) — tell the OS immediately, don't wait for the next tick.
    this.deps.publisher.pushStatus(this.deps.state.remoteStatus);
  }

  /**
   * Native playback status handler. Drives reconnect detection AND state
   * reconciliation: every native reality (audio flowing, focus-loss pause,
   * dead stream) is folded back into the state machine here, so the stores
   * and the media session can never drift from the audio.
   */
  private handlePlaybackStatus(status: AudioStatus): void {
    // Straggler native event after teardown — a destroyed instance must
    // not tick, poll or transition.
    if (this.disposed) return;

    // Stream is actually producing audio — resets the backoff chain
    if (status.playing) {
      this.deps.reconnect.reset();

      // Native self-recovery while the user has paused (in-flight
      // straggler event, rare interruption auto-resume) must not
      // resurrect audio against the user's intent — re-assert the pause.
      if (this.deps.state.state === "paused") {
        this.deps.transport.pause();
        return;
      }

      // Native 1 Hz heartbeat: drives progress + media-session pushes AND
      // the data poll while playing (see `HeartbeatScheduler`). These
      // events keep arriving while the app is backgrounded, where JS
      // timers freeze/throttle — without this, a live show's notification
      // keeps a stale title/cover forever.
      this.reconcile("playing");
      this.deps.heartbeat.beat();
      return;
    }

    // Natively paused without our say-so — audio focus loss, phone call,
    // car/Siri interruption. Adopt the native truth so the button and the
    // media session stop claiming "playing" while nothing plays. Dead
    // streams also report a paused time-control, so they are excluded
    // here and handled by the loss detection below.
    if (
      !status.isBuffering &&
      status.timeControlStatus === "paused" &&
      !DEAD_PLAYBACK_STATES.includes(
        status.playbackState as (typeof DEAD_PLAYBACK_STATES)[number],
      )
    ) {
      this.reconcile("paused");
      return;
    }

    // Stream died while the user wants playback → schedule reconnect.
    // The grace window filters transient native idle states (replace()).
    const streamLost =
      this.deps.state.isPlayingIntent &&
      !status.isBuffering &&
      DEAD_PLAYBACK_STATES.includes(
        status.playbackState as (typeof DEAD_PLAYBACK_STATES)[number],
      ) &&
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

    // Reconcile: the notification leaves "playing" the moment the stream
    // is lost (it used to stay stale until the next track change).
    this.reconcile("reconnecting");

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
      // Reconcile pushes "buffering" — no manual pushStatus needed.
      this.reconcile("connecting");
    } catch (error) {
      console.error("[PlayerService] Reconnect attempt failed:", error);
      this.scheduleReconnect();
    }
  }

  // ── Store emission (single writer) ──

  private nowPlayingInput(): NowPlayingInput {
    return {
      // The media session gets the locally cached cover file when it is
      // ready — its native loader has no UA/retry guarantees over HTTP.
      track: this.deps.artwork.apply(this.deps.repository.currentTrack),
      isLive: this.deps.repository.currentProgram?.isLive ?? false,
      showProgress: this.deps.repository.showProgress,
      defaultCover: this.deps.artwork.defaultCover,
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
      playbackState: this.deps.state.state,
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
    getDefaultCover: () => artwork.defaultCover,
    timer: jsTimer,
  });
  const networkMonitor = new NetworkMonitor(netInfoSubscribe);
  const artwork = new ArtworkResolver();
  const ticker = new ProgressTicker({
    repository,
    state,
    transport,
    publisher,
    buildMetadata: () =>
      buildNowPlayingMetadata({
        track: artwork.apply(repository.currentTrack),
        isLive: repository.currentProgram?.isLive ?? false,
        showProgress: repository.showProgress,
        defaultCover: artwork.defaultCover,
      }),
  });
  const heartbeat = new HeartbeatScheduler({
    repository,
    ticker,
    isPlayingIntent: () => state.isPlayingIntent,
    stateLabel: () => state.state,
    debug: CONFIG.DEBUG,
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
    heartbeat,
    artwork,
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
