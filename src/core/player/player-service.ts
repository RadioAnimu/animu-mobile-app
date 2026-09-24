import NetInfo from "@react-native-community/netinfo";
import { openBrowserAsync } from "expo-web-browser";
import type { HistoryType } from "@/@types/history-type.d";
import type { Track } from "@/core/domain/track";
import type { Stream } from "@/core/domain/stream";
import { animuService } from "@/core/services/animu.service";
import { userSettingsService } from "@/core/services/user-settings.service";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";
import { API } from "@/api";
import { animuApi, setServerSkewListener } from "@/api/client";
import { CONFIG, debugLog } from "@/utils/player.config";
import type {
  AudioEnginePort,
  AudioPlaybackStatus,
  MediaSessionPort,
  NowPlayingMetadata,
  RemoteCommandHandlers,
} from "@/core/player/ports";
import { ExpoAudioAdapter } from "@/core/player/adapters/expo-audio.adapter";
import { PlaybackControlsAdapter } from "@/core/player/adapters/playback-controls.adapter";
import { BackoffScheduler } from "@/core/player/stream-playback/backoff";
import {
  buildNowPlayingMetadata,
  type NowPlayingInput,
} from "@/core/player/media-session/now-playing.metadata";
import {
  ArtworkResolver,
  pickPreviewArtwork,
} from "@/core/player/storage/artwork";
import {
  CachedCoverLookup,
  CoverCacheSeeder,
  ExpoImageCoverDiskCache,
} from "@/core/player/storage/cover-image-cache";
import { HeartbeatScheduler } from "@/core/player/stream-playback/heartbeat";
import {
  NetworkMonitor,
  type ConnectivitySubscribe,
} from "@/core/player/stream-playback/network-monitor";
import {
  NowPlayingRepository,
} from "@/core/player/stream-playback/now-playing.repository";
import { ProgressTicker, toSec } from "@/core/player/stream-playback/progress-ticker";
import {
  getSyncedTrackProgress,
  StreamSyncEngine,
} from "@/core/player/stream-playback/stream-sync";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type StationSnapshot,
} from "@/core/player/store";
import { StreamPreferences } from "@/core/player/stream-playback/stream-preferences";
import { createVisualizerSampler } from "@/core/player/visualizer";
import type {
  VisualizerSampler,
  VisualizerWindow,
} from "@/core/player/visualizer/types";
import {
  TransportStateMachine,
  isDeadPlaybackState,
  type TransportState,
} from "@/core/player/stream-playback/transport-state";
import { jsTimer } from "@/core/player/timer";

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
 * Minimum stall (ms) after which resuming audio is treated as "fell behind
 * the live point" and the source is re-opened. A live stream is realtime:
 * every second spent buffering is a second behind live, and the native
 * player drains that stale buffer on recovery instead of snapping back.
 * Below this threshold the blip is left to the native player's own
 * recovery so sub-second hiccups don't churn the connection.
 */
const LIVE_STALL_REOPEN_MS = 2000;
/**
 * Maximum time (ms) the transport may stay in `connecting` before a fresh
 * native start is forced. A radio must never sit silently (iOS `AVPlayer`
 * can ignore a start issued before its item is ready, and a lost
 * ready-notification would otherwise leave the UI on "paused" forever).
 */
const CONNECTING_WATCHDOG_MS = 4000;
/**
 * How old the last measurement may be before a resume is treated as stale and
 * the clock is re-synced. A stream that was paused (or suspended in the
 * background) past this window is re-opened at the live edge, so the retained
 * lag is re-measured rather than trusted — a short pause stays seamless.
 */
const RESYNC_AFTER_MS = 15_000;

export interface PlayerServiceDependencies {
  state: TransportStateMachine;
  audio: AudioEnginePort;
  media: MediaSessionPort;
  sampler: VisualizerSampler;
  repository: NowPlayingRepository;
  streamPreferences: StreamPreferences;
  reconnect: BackoffScheduler;
  networkMonitor: NetworkMonitor;
  ticker: ProgressTicker;
  heartbeat: HeartbeatScheduler;
  artwork: ArtworkResolver;
  sync: StreamSyncEngine;
  audible: AudibleTrackResolver;
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
 * - `StreamSyncEngine`     — audible station clock (native live offset)
 * - `AudibleTrackResolver` — now-playing display held to the audible moment
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
  /**
   * Whether the *user* explicitly paused. A native pause (audio focus loss,
   * phone call, interruption) is adopted into the UI but leaves this false,
   * so when the OS resumes playback on its own the transport follows it.
   * A real user pause sets it, and any native self-recovery is re-paused.
   */
  private userPaused = false;
  /**
   * Set when the OS pauses playback on its own (audio-focus loss, phone
   * call) *while audio was actually flowing*. The next self-resume then
   * re-opens the source to land at the live edge instead of replaying the
   * stale buffered position.
   *
   * It is set ONLY from a `playing` state — never from the transient paused
   * frame that a source replace emits (our own live re-open, or
   * `changeStream`'s replace, both of which run while the state is
   * `connecting`). That is what stops the re-open from retriggering itself
   * in a loop.
   */
  private interruptionPending = false;
  /**
   * Date.now() when audio that WAS flowing fell into a buffering stall, or
   * null. Set only from a `playing` state (a stall opened while connecting
   * is our own source replace) and consumed on recovery. Mirrors
   * `interruptionPending`: the one-shot marker is what stops the re-open's
   * own transient buffering frame from retriggering itself into a loop.
   */
  private stalledSince: number | null = null;
  /**
   * Date.now() when the transport entered `connecting`, or null. Powers the
   * `CONNECTING_WATCHDOG_MS` safety net so a start that native ignored cannot
   * leave the app silently "paused".
   */
  private connectingSince: number | null = null;
  /**
   * Whether the app UI is foregrounded. While backgrounded, store emissions
   * are suppressed so nothing reconciles in the hidden tree; the native
   * player and media session keep running. Restored emissions happen on the
   * way back to the foreground.
   */
  private appActive = true;
  /** Dev-only sampled counter for the sync-math trace. */
  private syncDebugBeats = 0;
  /** Last observed settle state — drives the "calculating" UI flip. */
  private syncSettled = false;

  constructor(private readonly deps: PlayerServiceDependencies) {
    // ── Wiring: this class owns every cross-unit connection ──
    this.deps.audio.setStatusHandler((status) =>
      this.handlePlaybackStatus(status),
    );
    this.deps.repository.onChange = (change) => {
      // Route by change cadence: track/program → now-playing UI,
      // listeners/histories → poll-data UI. A listener-count tick never
      // re-renders the now-playing UI and vice versa.
      if (change.trackChanged || change.programChanged) {
        // The station's on-air item changed, but the speaker may still be on
        // the previous track — let the audible resolver decide what to show.
        if (change.trackChanged) {
          // The announcement is a full stream-lag ahead of the ear: warm the
          // cover now so it swaps in from disk the instant it is heard.
          this.prefetchArtwork(this.deps.repository.currentTrack);
          this.deps.audible.reconcile();
        }
        this.handleDisplayedTrackChange();
      }
      if (
        change.listenersChanged ||
        change.playedChanged ||
        change.requestedChanged
      ) {
        this.emitStation();
      }
    };
    // A deferred adoption (the announced track reached the speaker) must
    // reach the UI and the media session on its own.
    this.deps.audible.onChange = () => this.handleDisplayedTrackChange();
    this.deps.networkMonitor.onRestore = () => this.handleNetworkRestore();
    this.deps.heartbeat.onPoll = () => {
      void this.refreshData().catch(console.error);
    };
    // Live SSE track change → anchor the sync engine on the event's arrival
    // (the package's per-event `ts`) so the audible clock re-locks to this
    // track. The displayed metadata does NOT change here: the audible
    // resolver holds the previous track on screen until the new one is heard.
    this.deps.repository.onLiveTrackChange = (track, receivedAt) => {
      this.deps.sync.updateFromAnchor({
        startTimeMs: track.startTime.getTime(),
        receivedAtMs: receivedAt.getTime(),
      });
      debugLog(
        `[ArtDebug] LIVE track change → "${track.title ?? "?"}" artwork=${track.artwork}`,
      );
    };
  }

  // ── Session ──

  /**
   * Applies the audio-session mode and starts the media session. Idempotent:
   * the audio mode is applied once, the media session is a no-op once active.
   */
  private async ensureSession(): Promise<void> {
    await this.deps.audio.ensureAudioMode();
    await this.deps.media.start();
  }

  /** Routes remote media-session commands (lock screen) into the player. */
  setRemoteHandlers(handlers: RemoteCommandHandlers): void {
    this.deps.media.setHandlers(handlers);
  }

  // ── Queries ──

  /** Whether the user's last action was "play" (covers the intent chain). */
  get isPlayingIntent(): boolean {
    return this.deps.state.isPlayingIntent;
  }

  /**
   * Whether audio can actually be driven: a native player exists and a
   * track is on air. (The media session is intentionally *not* part of
   * this: a failed/deferred notification must never block playback or the
   * foreground data refresh.)
   */
  get isReady(): boolean {
    return this.deps.audio.hasPlayer && this.deps.repository.hasTrack;
  }

  getNowPlayingMetadata(): NowPlayingMetadata {
    return buildNowPlayingMetadata(this.nowPlayingInput());
  }

  // ── Visualizer ──

  /** Whether the platform can sample the player for visualization. */
  get isVisualizerSupported(): boolean {
    return this.deps.sampler.isSupported;
  }

/**
   * Enables/disables the oscilloscope. The emission rate is uncapped (the
   * renderer paces itself at the display's vsync, like the web player).
   */
  setVisualizerEnabled(enabled: boolean): void {
    this.deps.sampler.setEnabled(enabled);
  }

  /**
   * Subscribes to raw waveform windows (the WebView visualizer interpolates
   * and draws them itself — no RN-side per-frame work).
   */
  subscribeVisualizerWindows(
    listener: (window: VisualizerWindow) => void,
  ): () => void {
    return this.deps.sampler.subscribeWindows(listener);
  }

  /**
   * Feedback from the WebView visualizer: the delay it actually applied for
   * the last window. Powers the sampler's auto-sync calibration.
   */
  reportVisualizerDelay(appliedMs: number): void {
    this.deps.sampler.reportAppliedDelay?.(appliedMs);
  }

  /** Manual sync bias (ms) for the oscilloscope; positive = later. */
  setVisualizerSyncTrim(trimMs: number): void {
    this.deps.sampler.setSyncTrim?.(trimMs);
  }

  private applyVisualizerSettings(): void {
    // Uncapped, like the web player's rAF loop: the sampler emits without a
    // rate cap and the visualizer commits at the display's own vsync.
    this.deps.sampler.setEnabled(
      userSettingsService.getCurrentSettings().visualizerHz > 0,
    );
  }

  // ── Realtime stream battery policy ──

  /**
   * Keeps the realtime (SSE) surface aligned with where the user is:
   * keep it open while the app is visible, while the user wants audio, or
   * when they opted to always keep live updates running. A paused app in
   * the background with the setting off drops the connection — nothing a
   * user notices immediately (the HTTP poll + staleness fallback cover
   * freshness on the way back), but a real battery win for the idle case.
   * Also the hook that re-evaluates when the user toggles the setting.
   */
  updateLiveStreamLifecycle(): void {
    const enabled = userSettingsService.getCurrentSettings().liveUpdatesInBackground;
    const wanted =
      enabled || this.appActive || this.deps.state.isPlayingIntent;
    this.deps.repository.setLiveStreamActive(wanted);
  }

  // ── Lifecycle ──

  /**
   * App visibility gate (driven by AppState).
   *
   * Backgrounded: the progress ticker stops writing the UI store and the
   * data-poll cadence slows, so the frozen tree does almost no work while
   * audio + the media session keep going. Foregrounded: every surface is
   * re-emitted so the thawed UI catches up on anything missed.
   */
  setAppActive(active: boolean): void {
    if (this.appActive === active) return;
    this.appActive = active;
    this.deps.ticker.setUiVisible(active);
    this.deps.heartbeat.setUiVisible(active);
    this.deps.sampler.setForeground(active);
    // Visibility is part of the realtime-surface battery policy: once
    // paused, backgrounding may drop the connection (see the setting).
    this.updateLiveStreamLifecycle();
    if (active) {
      this.deps.audible.adoptIfDue();
      this.emitPlayer();
      this.emitStation();
      this.emitProgress();
    }
  }

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
      // Media-session start is best-effort: if the OS refuses it at boot
      // (e.g. not foreground yet) playback must still come up and the
      // session is retried on the next play(). Never let it wedge bootstrap.
      this.ensureSession().catch((error) => {
        console.warn(
          "[PlayerService] media session deferred — will retry on play:",
          error,
        );
      }),
      userSettingsService.initialize(), // pre-warm cache
      this.deps.artwork.init(), // pre-warm the local default cover
    ]);
    // Destroyed while bootstrapping (e.g. unmount mid-setup) — bail
    // before touching any state or store.
    if (this.disposed) return;
    this.streamOptions = streams;

    // Settings are now loaded — arm the visualizer with the stored preference.
    this.applyVisualizerSettings();

    // Realtime now-playing (SSE). The first push carries the current state,
    // so a poll is not needed to know what's on air; the HTTP metadata leg
    // stays available as fallback behind LIVE_STALE_MS. The settings are
    // loaded, so the battery policy consults the stored preference.
    this.updateLiveStreamLifecycle();

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
    if (this.deps.repository.hasTrack && this.deps.media.isActive) {
      this.deps.media.push(
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
    this.userPaused = false;
    this.interruptionPending = false;
    this.stalledSince = null;
    this.setupPromise = null;

    if (!this.isReady) {
      // Half-set-up or already destroyed: release whatever exists.
      this.deps.repository.dispose();
      this.deps.reconnect.reset();
      this.deps.networkMonitor.stop();
      this.deps.heartbeat.reset();
      this.deps.artwork.reset();
      this.deps.sampler.dispose();
      this.deps.sync.reset();
      this.deps.audible.reset();
      if (this.deps.audio.hasPlayer) {
        this.deps.audio.dispose();
      }
      await this.deps.media.end().catch(() => {});
      this.deps.state.transition("idle");
      this.initialized = false;
      this.emitPlayer();
      resetPlayerServiceSingleton();
      return;
    }

    try {
      this.deps.audio.dispose();
      this.deps.reconnect.reset();
      this.deps.networkMonitor.stop();
      await this.deps.media.end();

      this.deps.repository.dispose();
      this.deps.state.transition("idle");
      this.deps.streamPreferences.reset();
      this.deps.repository.clear();
      this.deps.ticker.reset();
      this.deps.heartbeat.reset();
      this.deps.artwork.reset();
      this.deps.sampler.dispose();
      this.deps.sync.reset();
      this.deps.audible.reset();
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
    // The user is choosing to play — an interruption that happens later is
    // no longer "resume the user's stream", it's a fresh intent.
    this.userPaused = false;
    this.interruptionPending = false;
    this.stalledSince = null;

    try {
      // Ensure audio mode + media session are set up, then resolve the
      // stored stream (setupPlayer already persisted a valid default).
      if (!this.deps.media.isActive) {
        try {
          await this.ensureSession();
        } catch (error) {
          // Audio still plays; only the OS controls are missing. The next
          // play() retries the session.
          console.warn(
            "[PlayerService] playing without media session:",
            error,
          );
        }
        await this.deps.streamPreferences.restore(this.streamOptions);
      }

      // Fresh playback session: clear any reconnect state
      this.deps.reconnect.reset();
      // …and restart the heartbeat cadence (first native tick processes
      // immediately; the poll cycle counts from zero)
      this.deps.heartbeat.reset();

      // A long pause (or background suspension) leaves the retained lag stale:
      // the source below re-opens at the live edge, so re-lock the clock.
      // A short pause is seamless — the estimate is still fresh.
      if (
        this.deps.sync.hasMeasurement &&
        this.deps.sync.isStale(RESYNC_AFTER_MS)
      ) {
        this.reacquireSyncClock();
      }

      this.deps.audio.play(this.deps.streamPreferences.current.url);
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
    // The user explicitly paused: latch it so native self-recovery (focus
    // regain, interruption end) can never resurrect the stream.
    this.userPaused = true;
    this.interruptionPending = false;
    this.stalledSince = null;

    // Pausing only needs the audio transport — a failed/slow now-playing
    // fetch, or a media session that never started, must never make the
    // audio unpausable.
    if (!this.deps.audio.hasPlayer || this.deps.state.state === "paused") {
      return;
    }

    try {
      // User paused — stop any pending stream reconnects first
      this.deps.reconnect.cancel();

      this.deps.audio.pause();
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

  /**
   * Re-locks the audible clock after the source is (re)opened — a manual
   * re-tune, a reconnect, a stall recovery, an interruption resume, or a
   * stale resume. Drops the old lag so the first reading of the rebuilt
   * buffer snaps, and holds the display (`beginReacquire`) until it is
   * measured so a relay that landed behind cannot flash the announced track
   * early.
   */
  private reacquireSyncClock(): void {
    this.deps.sync.reset();
    this.deps.audible.beginReacquire();
    // Evaluate immediately so the hold engages before the next native frame.
    this.deps.audible.adoptIfDue();
  }

  async changeStream(stream: Stream): Promise<void> {
    if (this.deps.streamPreferences.current.id === stream.id) return;

    await this.deps.streamPreferences.set(stream);

    // If the audio transport exists, swap the stream without destroying
    // the media session — just replace the audio source. (Deliberately
    // not `isReady`: a missing track snapshot must not leave the audio
    // playing the OLD stream while the store already records the new one.)
    if (this.deps.audio.hasPlayer) {
      const wasPlaying = this.deps.state.isPlayingIntent;

      // A pending reconnect would double-fire after the manual re-tune
      this.deps.reconnect.cancel();
      // A manual re-tune is a fresh intent — no pending live-edge re-open.
      this.interruptionPending = false;
      this.stalledSince = null;
      // A different relay buffers differently AND may sit at a different
      // point in the broadcast — re-lock the clock (see `reacquireSyncClock`).
      this.reacquireSyncClock();

      this.deps.audio.load(stream.url);
      if (wasPlaying) {
        this.deps.audio.resume();
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
    if (changed && CONFIG.DEBUG) {
      console.info(
        `[PlayerService] track/program changed → updating media session: ${
          this.deps.repository.currentTrack?.title ?? "?"
        }`,
      );
    }
    // The repository's onChange handler already routed the change through the
    // audible resolver, which emits the UI and pushes the media session.
    return changed;
  }

  async refreshHistory(type: HistoryType): Promise<void> {
    await this.deps.repository.refreshHistory(type);
  }

  /**
   * Warms the cover of a freshly *announced* track while the speaker is still
   * on the previous one.
   *
   * The station announces a `song_change` a whole stream-lag before the ear
   * reaches it (the sync engine's delay — seconds on iOS, tens of seconds on
   * Android). Downloading the artwork during that window means that when the
   * audible resolver adopts the track, `updateMetadata` finds the file already
   * in the cache and swaps the cover from disk in one push, instead of the
   * "clanky" remote-load-then-swap that lands seconds late.
   *
   * Fire-and-forget: a failed prefetch simply leaves the normal
   * resolve-on-adoption path to do the work. `resolve()` de-dupes against the
   * adoption call through its in-flight map, so this never double-downloads.
   *
   * Fetches the reported low-res sibling (a few KB) in parallel with the
   * full-size cover. The selected-quality image may not have landed by the
   * time the song is heard, but the tiny almost always has — so the cover
   * paints instantly at adoption and swaps up when the full arrives, rather
   * than staying blank. The tiny is resolved under its own URL (not mapped
   * onto the full one) so the adoption call can still drive the full swap.
   */
  private prefetchArtwork(track: Track | null | undefined): void {
    const url = track?.artwork;
    if (!url || !this.deps.artwork.isRemote(url)) return;
    if (this.deps.artwork.peek(url)) return;
    // No link → skip the pointless attempt; the adoption path retries once
    // connectivity (and the track) is live again.
    if (!this.deps.networkMonitor.isOnline()) return;
    const preview = pickPreviewArtwork(url, track?.artworks);
    debugLog(
      `[ArtDebug] prefetch START "${track?.title ?? "?"}" artwork=${url} preview=${preview ?? "none"}`,
    );
    void Promise.all([
      this.deps.artwork.resolve(url),
      ...(preview ? [this.deps.artwork.resolve(preview)] : []),
    ])
      .then(([resolved]) => {
        debugLog(
          `[ArtDebug] prefetch READY "${track?.title ?? "?"}" → ${resolved}`,
        );
      })
      .catch(() => {
        // resolve() already degrades to the remote URL; this only stops an
        // unhandled rejection from ever surfacing.
      });
  }

  async updateMetadata(): Promise<void> {
    try {
      // Download the cover to a local file so the media session's native
      // loader renders it reliably. The first push uses the remote URL
      // as-is; when the local file lands, push again so the notification
      // swaps to the file URI within seconds. Skipped when the song
      // changed mid-download — that push owns the session.
      //
      // Only remote URLs enter the download/re-push dance. Local artwork
      // (e.g. the bundled default when "Live covers" is off, or an
      // already-resolved file) is final — `resolve()` passes it through
      // WITHOUT tracking it, so a "re-push until peek hits" loop would
      // recurse forever and wedge the JS thread.
      //
      // Android note: SystemUI cannot OPEN app-private `file://` artwork
      // cross-process (scoped-storage ENOENT), which is why the native
      // module is patched to read the bytes in-process and publish them
      // as `artworkData` (`setArtworkData` → `METADATA_KEY_ART`) — the
      // loaders render those with no IO of their own.
      const artworkUrl = this.deps.audible.track?.artwork;
      const peeked = artworkUrl ? this.deps.artwork.peek(artworkUrl) : undefined;
      const t0 = Date.now();
      debugLog(
        `[ArtDebug] updateMetadata track="${this.deps.audible.track?.title ?? "?"}" artwork="${artworkUrl ?? "none"}" peeked=${peeked ?? "MISS"}`,
      );
      if (
        artworkUrl &&
        this.deps.artwork.isRemote(artworkUrl) &&
        !peeked
      ) {
        // Only sizes the API actually reports (`track.artworks`) — the
        // CDN's own naming scheme 302s unknown sizes to a placeholder.
        void this.deps.artwork
          .resolve(
            artworkUrl,
            (preview) => {
              // Low-res cover painted as soon as the reported low-size
              // sibling lands — the full-size swap happens in
              // resolve.then below.
              if (this.deps.audible.track?.artwork === artworkUrl) {
                this.pushNowPlaying();
                this.emitPlayer();
              }
            },
            pickPreviewArtwork(
              artworkUrl,
              this.deps.audible.track?.artworks,
            ),
          )
          .then((resolved) => {
          const dt = Date.now() - t0;
          debugLog(
            `[ArtDebug] resolve.then after ${dt}ms sameTrack=${this.deps.audible.track?.artwork === artworkUrl} resolved=${resolved}`,
          );
          if (this.deps.audible.track?.artwork === artworkUrl) {
            this.pushNowPlaying();
            // Hand the UI the local file too — otherwise expo-image
            // re-downloads the same cover over the network while the
            // audio stream hogs the connection (measured: multi-minute
            // onLoad on a hotspot → blank-to-slow cover).
            this.emitPlayer();
          }
        });
      }

      this.pushNowPlaying();
    } catch (error) {
      console.error("[PlayerService] Metadata update error:", error);
    }
  }

  private pushNowPlaying(): void {
    const { elapsedMs, pending } = getSyncedTrackProgress(
      this.deps.audible.track,
      this.deps.sync.now(),
    );
    this.deps.media.push(
      this.getNowPlayingMetadata(),
      this.deps.state.remoteStatus,
      // Until the estimate settles the progress is a wall-clock guess —
      // withhold it (and, via `nowPlayingInput`, the seek bar) so the lock
      // screen does not show an unsynced position.
      !this.deps.sync.settled
        ? undefined
        : // A freshly-announced track that is still buffered reports position 0:
          // the speaker is finishing the previous one and the OS seek bar must
          // not jump to the live point.
          pending
          ? 0
          : toSec(elapsedMs),
    );
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
    this.deps.audible.adoptIfDue();
    this.deps.heartbeat.beat();
  }

  // ── Artwork (shared resolver for the now-playing UI) ──

  /**
   * Sync peek at a previously-resolved local file for a remote cover URL,
   * and the awaited resolution (deduped with the media session's own
   * download). The now-playing UI renders the resolver's file so expo-image
   * never re-downloads a cover the resolver already has in flight — two
   * parallel fetches of the same cover over a saturated connection were
   * measured at 33s/44s.
   */
  peekArtwork(url: string): string | undefined {
    return this.deps.artwork.peek(url);
  }

  resolveArtwork(
    url: string,
    onPreview?: (local: string) => void,
    previewUrl?: string | null,
  ): Promise<string> {
    return this.deps.artwork.resolve(url, onPreview, previewUrl);
  }

  /** Bundled default cover as a loadable URI (see `ArtworkResolver`). */
  get defaultArtwork(): string {
    return this.deps.artwork.defaultCover;
  }

  async openPedidosURL(): Promise<void> {
    await openBrowserAsync(API.REQUESTS_URL);
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
    // Arm/disarm the "connecting" watchdog on the effective state.
    if (this.deps.state.state === "connecting") {
      if (this.connectingSince == null) this.connectingSince = Date.now();
    } else {
      this.connectingSince = null;
    }
    // Sampling follows play intent — the visualizer only runs with audio.
    this.deps.sampler.setPlaying(this.deps.state.isPlayingIntent);
    // The playing/paused intent is also part of the realtime-surface
    // battery policy: resuming playback re-opens the connection even when
    // the app stays hidden behind the lock screen.
    this.updateLiveStreamLifecycle();
    // Any state change is UI-visible: isPlaying and playbackState derive
    // from the state machine.
    this.emitPlayer();
    // …and it changes the media session's affordance (play/pause/loading
    // icon) — tell the OS immediately, don't wait for the next tick.
    this.deps.media.pushStatus(this.deps.state.remoteStatus);
  }

  /**
   * Native playback status handler. Drives reconnect detection AND state
   * reconciliation: every native reality (audio flowing, focus-loss pause,
   * dead stream) is folded back into the state machine here, so the stores
   * and the media session can never drift from the audio.
   */
  private handlePlaybackStatus(status: AudioPlaybackStatus): void {
    // Straggler native event after teardown — a destroyed instance must
    // not tick, poll or transition.
    if (this.disposed) return;

    // Feed the audible-clock estimate on EVERY native frame (including
    // buffering ones): the offset is what shifts progress, the countdown and
    // the media-session position back to what the speaker is producing.
    this.deps.sync.updateFromStatus({
      isLive: status.isLive ?? false,
      offsetFromLive: status.currentOffsetFromLive ?? null,
      bufferedAheadSeconds: status.bufferedAheadSeconds ?? null,
    });
    // The estimate settling (or losing its measurement on reset) flips the
    // "calculating" state — emit so the header bar and countdown leave it
    // without waiting for the next song/transport change.
    if (this.syncSettled !== this.deps.sync.settled) {
      this.syncSettled = this.deps.sync.settled;
      this.emitPlayer();
    }
    // The lag may have shifted under a pending track — adopt it the moment
    // it is due instead of waiting for the boundary timer to be corrected.
    this.deps.audible.adoptIfDue();

    if (CONFIG.DEBUG) this.logSyncDebug(status);

    if (this.handleBuffering(status)) return;
    if (this.handlePlaying(status)) return;
    if (this.handleNativelyPaused(status)) return;
    this.handleStreamLost(status);
  }

  /**
   * Android's status mapper reports `playing: true` (the *intended* state)
   * while still buffering. Buffering is not audio flow, so it is handled
   * before the "audio is flowing" branch — but a transient buffer frame
   * while we are already `connecting` (opening / reconnecting / a stream
   * swap) must not knock the state machine back into `connecting` every
   * tick. On iOS `playImmediately` briefly reports a waiting (buffering)
   * time-control; without this guard the state machine is held in
   * `connecting` and the player looks permanently paused.
   *
   * @returns true when the event was a buffering frame (handled here).
   */
  private handleBuffering(status: AudioPlaybackStatus): boolean {
    if (!status.isBuffering) return false;

    if (this.deps.state.isPlayingIntent) {
      // Audio that was flowing just stalled — remember when, so a recovery
      // after the drift threshold can re-open at the live edge. Only arm
      // from `playing`: a stall while `connecting` is our own stream
      // replace, not a link that fell behind.
      if (this.deps.state.state === "playing") {
        this.stalledSince = Date.now();
        this.reconcile("connecting");
      }
      this.enforceConnectingWatchdog();
    }
    this.deps.heartbeat.beat();
    return true;
  }

  /**
   * The stream is actually producing audio. Resets the backoff chain,
   * re-opens the source after a long stall or a native interruption so a
   * radio lands on the live edge, and beats the native heartbeat (which
   * drives progress, the media session and the data poll while playing).
   *
   * @returns true when the event reported audio flowing (handled here).
   */
  private handlePlaying(status: AudioPlaybackStatus): boolean {
    if (!status.playing) return false;

    this.deps.reconnect.reset();

    // Recovering from a stall long enough to have fallen behind: re-open
    // the source so a radio lands on the live edge instead of draining
    // the stale buffer it accumulated. Consume the marker first so the
    // re-open's own buffering frame (state `connecting`) cannot loop.
    if (this.stalledSince != null) {
      const stalledFor = Date.now() - this.stalledSince;
      this.stalledSince = null;
      if (stalledFor >= LIVE_STALL_REOPEN_MS) {
        this.reacquireSyncClock();
        this.deps.audio.play(this.deps.streamPreferences.current.url);
        this.reconcile("connecting");
        this.deps.heartbeat.beat();
        return true;
      }
    }

    if (this.deps.state.state === "paused") {
      // The user stopped this stream — an in-flight straggler event or a
      // rare auto-resume must not resurrect audio against their intent.
      if (this.userPaused) {
        this.deps.audio.pause();
        return true;
      }
      // The pause was native (focus loss, phone call) and the OS has just
      // resumed on its own (Android AUDIOFOCUS_GAIN, iOS .shouldResume).
      // For a radio, the native player would continue from the paused
      // position — stale, already-played audio — so a *genuine*
      // interruption re-opens the source to land at the live edge. The
      // one-shot flag is what keeps this from looping: the re-open's own
      // transient paused→playing frame leaves it clear.
      if (this.interruptionPending) {
        this.interruptionPending = false;
        this.reacquireSyncClock();
        this.deps.audio.play(this.deps.streamPreferences.current.url);
        this.reconcile("connecting");
        this.deps.heartbeat.beat();
        return true;
      }
      // Otherwise adopt the resumed audio as-is (transient flap).
    }

    // Native 1 Hz heartbeat: drives progress + media-session pushes AND
    // the data poll while playing (see `HeartbeatScheduler`). These
    // events keep arriving while the app is backgrounded, where JS
    // timers freeze/throttle — without this, a live show's notification
    // keeps a stale title/cover forever.
    this.reconcile("playing");
    this.deps.heartbeat.beat();
    return true;
  }

  /**
   * Natively paused without our say-so — audio focus loss, phone call,
   * car/Siri interruption. Adopts the native truth so the button and the
   * media session stop claiming "playing" while nothing plays. Dead
   * streams also report a paused time-control, so they are excluded here
   * and handled by {@link handleStreamLost}.
   *
   * @returns true when the event was a genuine native pause (handled here).
   */
  private handleNativelyPaused(status: AudioPlaybackStatus): boolean {
    if (
      status.isBuffering ||
      status.timeControlStatus !== "paused" ||
      isDeadPlaybackState(status.playbackState)
    ) {
      return false;
    }

    // A paused time-control while the state machine is still `connecting`
    // means a start was issued but native never began (typical when iOS
    // `playImmediately` ran before the item was ready). Don't latch a
    // user-visible pause — force a fresh native start until it takes.
    if (this.deps.state.state === "connecting") {
      this.enforceConnectingWatchdog();
      this.deps.heartbeat.beat();
      return true;
    }
    // A pause while audio was actually flowing is a real interruption
    // (call, focus loss) and must arm the live-edge re-open.
    if (this.deps.state.state === "playing") {
      this.interruptionPending = true;
    }
    this.reconcile("paused");
    return true;
  }

  /**
   * Stream died while the user wants playback → schedule reconnect. The
   * grace window filters transient native idle states (`replace()`).
   */
  private handleStreamLost(status: AudioPlaybackStatus): void {
    const streamLost =
      this.deps.state.isPlayingIntent &&
      !status.isBuffering &&
      isDeadPlaybackState(status.playbackState) &&
      Date.now() - this.deps.state.enteredAt > STREAM_DEATH_GRACE_MS;

    if (streamLost) {
      this.scheduleReconnect();
    }
  }

  /**
   * Safety net for a native start that did not take (see
   * `CONNECTING_WATCHDOG_MS`). Re-issues the start while playback is wanted
   * and we are still `connecting`; a no-op before the deadline or after the
   * transport left `connecting`.
   */
  private enforceConnectingWatchdog(): void {
    if (
      this.connectingSince == null ||
      !this.deps.state.isPlayingIntent ||
      this.deps.state.state !== "connecting" ||
      Date.now() - this.connectingSince < CONNECTING_WATCHDOG_MS
    ) {
      return;
    }
    console.warn(
      "[PlayerService] transport stuck connecting — forcing native start",
    );
    // Restart the clock so a failed retry waits another full window.
    this.connectingSince = Date.now();
    this.deps.audio.resume();
  }

  private handleNetworkRestore(): void {
    if (this.disposed) return;

    // Instant reconnect instead of waiting the backoff out
    this.deps.reconnect.reset();
    // The link came back — a stale stall marker must not double-re-open.
    this.stalledSince = null;

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
    if (!this.deps.state.isPlayingIntent || !this.deps.audio.hasPlayer) {
      return;
    }

    try {
      // Reconnect re-opens live anyway — drop any pending interruption.
      this.interruptionPending = false;
      this.stalledSince = null;
      // The source is re-opened: re-lock the audible clock.
      this.reacquireSyncClock();
      this.deps.audio.play(this.deps.streamPreferences.current.url);
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
      // ready. iOS reads `file://` URIs itself; on Android the native
      // module (patched) reads the bytes in-process and publishes them
      // as `artworkData` — a plain `file://` URI would fail cross-process
      // under scoped storage (ENOENT).
      track: this.deps.artwork.apply(this.deps.audible.track),
      isLive: this.deps.repository.currentProgram?.isLive ?? false,
      // No seek bar until the estimate settles — the duration drives the OS
      // bar, and an unsettled position would run ahead of the speaker.
      showProgress:
        this.deps.repository.showProgress && this.deps.sync.settled,
      defaultCover: this.deps.artwork.defaultCover,
    };
  }

  /**
   * Dev-only sampled trace of the sync math: native inputs (live offset,
   * forward buffer, playhead) alongside the engine's outputs (lag, clock
   * skew, audible station clock) and the resulting track progress. One line
   * per ~5 native frames, so a real session can be checked against the
   * station without flooding the console.
   */
  private logSyncDebug(status: AudioPlaybackStatus): void {
    this.syncDebugBeats += 1;
    if (this.syncDebugBeats % 5 !== 0) return;
    const track = this.deps.audible.track ?? this.deps.repository.currentTrack;
    const start = track?.startTime?.getTime();
    const now = this.deps.sync.now();
    console.log(
      `[SyncDebug] isLive=${status.isLive ?? "?"} offLive=${
        status.currentOffsetFromLive ?? "null"
      } bufAhead=${status.bufferedAheadSeconds ?? "null"} curTime=${
        status.currentTime?.toFixed?.(1) ?? status.currentTime ?? "?"
      } | delay=${Math.round(this.deps.sync.delay)}ms skew=${Math.round(
        this.deps.sync.clockSkew,
      )}ms measured=${this.deps.sync.hasMeasurement} | audibleNow=${Math.round(
        now,
      )} elapsed=${start != null ? Math.round(now - start) : "?"}ms dur=${
        track?.duration ?? "?"
      } track="${track?.title ?? "?"}"`,
    );
  }

  /**
   * The displayed (audible) track changed — either the station announced a
   * track that is already audible, or a deferred one just crossed into the
   * speaker. Emits the now-playing UI, the progress store and the media
   * session so title, cover, lock screen and seek bar all move together.
   */
  private handleDisplayedTrackChange(): void {
    this.emitPlayer();
    this.emitProgress();
    void this.updateMetadata();
  }

  /** Now-playing snapshot — per song / program / stream / user action. */
  private emitPlayer(): void {
    if (!this.appActive) return;
    const next: PlayerSnapshot = {
      // Same rule as `nowPlayingInput`: the locally cached cover file is
      // preferred for the UI render too so expo-image never re-downloads
      // a cover the resolver already has on disk (`apply` is a sync
      // LRU-map peek, so it costs nothing when the file isn't ready).
      currentTrack:
        this.deps.artwork.apply(this.deps.audible.track) ?? undefined,
      currentProgram: this.deps.repository.currentProgram ?? undefined,
      currentStream: this.deps.streamPreferences.current,
      streamOptions: this.streamOptions,
      isPlaying: this.isPlayingIntent,
      playbackState: this.deps.state.state,
      isInitialized: this.initialized,
      // Playing but the estimate has not settled → the UI shows the muted
      // "calculating" state until the clock is actually locked.
      syncing: this.isPlayingIntent && !this.deps.sync.settled,
    };
    playerStore.setSnapshot(next);
  }

  /** Poll-data snapshot — listeners + histories. */
  private emitStation(): void {
    if (!this.appActive) return;
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
    if (!this.appActive) return;
    const { elapsedMs, pending } = getSyncedTrackProgress(
      this.deps.audible.track,
      this.deps.sync.now(),
    );
    progressStore.setSnapshot({
      // While the announced track is still buffered, leave the bar where the
      // ticker carried it (the previous track is finishing) instead of
      // flashing it back to 0 on a foreground catch-up.
      currentTrackProgress: pending
        ? progressStore.getSnapshot().currentTrackProgress
        : elapsedMs,
      showProgress: this.deps.repository.showProgress,
    });
  }
}

// ─── Singleton factory ───

const netInfoSubscribe: ConnectivitySubscribe = (handler) =>
  NetInfo.addEventListener((state) =>
    handler({
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
    }),
  );

let playerServiceInstance: PlayerService | null = null;

/** Builds a fully-wired PlayerService with production dependencies. */
export const createPlayerService = (): PlayerService => {
  const state = new TransportStateMachine();
  // The audible station clock: turns the native live offset into the instant
  // the speaker is producing, so every station-timeline surface stays on the
  // audio the listener hears rather than the station's live point.
  const sync = new StreamSyncEngine();
  // Feed the engine the server-vs-device clock offset from every HTTP
  // response's `date` header (the app already makes these requests). Keeps
  // the station-timeline comparison valid on a device with a wrong clock.
  setServerSkewListener((skewMs) => sync.setClockSkew(skewMs));
  // The only two places the native libraries are touched live in these
  // adapters; the rest of the core depends on the ports.
  const audio = new ExpoAudioAdapter();
  const media = new PlaybackControlsAdapter();
  const sampler = createVisualizerSampler(audio);
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
    // Track-end refreshes fire on the audible timeline, not the station's.
    getNow: () => sync.now(),
  });
  const networkMonitor = new NetworkMonitor(netInfoSubscribe);
  // Bridges the media-session artwork with the in-app image cache: any
  // surface (search row, history, player frame) that already has a cover
  // on disk satisfies the resolver, and a fresh resolver download seeds
  // back for the reverse journey.
  const coverDiskCache = new ExpoImageCoverDiskCache();
  const coverLookup = new CachedCoverLookup(coverDiskCache);
  const coverSeeder = new CoverCacheSeeder(coverDiskCache);
  const artwork = new ArtworkResolver({
    onResolved: (localUri, remoteUrl) => {
      // Attribute the resolver's download to the live surface at the seam
      // where the remote URL is still known: the in-app player frame
      // renders the local `file://` URI and the registry only accepts
      // remote URLs, so display-time tagging can never see this cover —
      // the live partition would report 0 forever. The media session's
      // downloads are gated by the same cache setting as every other
      // surface's tags; the seed keeps its unconditional bridging role.
      if (userSettingsService.getCurrentSettings().cacheEnabled) {
        coverCacheRegistry.tag(remoteUrl, "live");
      }
      return coverSeeder.seed(localUri, remoteUrl);
    },
    findCachedCoverFile: coverLookup.find.bind(coverLookup),
  });
  // Holds the announced track back until the speaker reaches it, so the
  // title/cover/lock screen flip when the song is heard — not when the
  // station announces it.
  const audible = new AudibleTrackResolver({
    getStationTrack: () => repository.currentTrack,
    sync,
    timer: jsTimer,
  });
  const ticker = new ProgressTicker({
    repository,
    state,
    audio,
    media,
    sync,
    getTrack: () => audible.track,
    buildMetadata: () =>
      buildNowPlayingMetadata({
        // Local cover file when it exists — the patched native module
        // reads it in-process and publishes artworkData on Android.
        track: artwork.apply(audible.track),
        isLive: repository.currentProgram?.isLive ?? false,
        // Withhold the seek bar until the estimate settles (see `pushNowPlaying`).
        showProgress: repository.showProgress && sync.settled,
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
    audio,
    media,
    sampler,
    repository,
    streamPreferences,
    reconnect,
    networkMonitor,
    ticker,
    heartbeat,
    artwork,
    sync,
    audible,
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
