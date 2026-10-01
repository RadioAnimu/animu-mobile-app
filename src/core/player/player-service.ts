import type { HistoryType } from "animu-api";
import type { Stream } from "@/core/domain/stream";
import { userSettingsService } from "@/core/services/user-settings.service";
import type { listenStatsService } from "@/core/services/listen-stats.service";
import { animuApi } from "@/api/client";
import { CONFIG, debugLog } from "@/utils/player.config";
import {
  isSelfResumingInterruption,
  type AudioEnginePort,
  type AudioInterruption,
  type AudioPlaybackStatus,
  type MediaSessionPort,
  type NowPlayingMetadata,
  type RemoteCommandHandlers,
} from "@/core/player/ports";
import type { BackoffScheduler } from "@/core/player/stream-playback/backoff";
import {
  buildNowPlayingMetadata,
  type NowPlayingInput,
} from "@/core/player/media-session/now-playing.metadata";
import {
  pickPreviewArtwork,
  type ArtworkResolver,
} from "@/core/player/storage/artwork";
import type {
  HeartbeatDriver,
  HeartbeatScheduler,
} from "@/core/player/stream-playback/heartbeat";
import type { NetworkMonitor } from "@/core/player/stream-playback/network-monitor";
import type { NowPlayingRepository } from "@/core/player/stream-playback/now-playing.repository";
import {
  toSec,
  type ProgressTicker,
} from "@/core/player/stream-playback/progress-ticker";
import {
  getSyncedTrackProgress,
  type StreamSyncEngine,
} from "@/core/player/stream-playback/stream-sync";
import type { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type StationSnapshot,
} from "@/core/player/store";
import type { StreamPreferences } from "@/core/player/stream-playback/stream-preferences";
import type {
  VisualizerSampler,
  VisualizerWindow,
} from "@/core/player/visualizer/types";
import {
  isDeadPlaybackState,
  type TransportState,
  type TransportStateMachine,
} from "@/core/player/stream-playback/transport-state";
import { createPumpedTimer, type PumpedTimer } from "@/core/player/timer";
import { logSyncDebug, logTransportTransition } from "@/core/player/sync-debug";

import {
  STREAM_DEATH_GRACE_MS,
  LIVE_STALL_REOPEN_MS,
  CONNECTING_WATCHDOG_MS,
  CONNECTING_REOPEN_WINDOWS,
  SILENT_STALL_MS,
  SUSPECT_SILENT_STALL_MS,
  NETWORK_SUSPECT_MS,
  STALL_REOPEN_ONLINE_MS,
  SUSPECT_STALL_REOPEN_MS,
  DEAD_LATCH_MS,
  OFFLINE_PROBE_EVERY,
  RESYNC_AFTER_MS,
  PAUSE_RELEASE_MS,
} from "@/core/player/recovery-config";
import { prefetchArtwork } from "@/core/player/artwork-prefetch";
import { PauseReleaseTimer } from "@/core/player/pause-release-timer";

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
  /**
   * On-device listen-stats recorder (optional — test fixtures omit it).
   * Fed the transport lifecycle and audible-track changes so listening
   * minutes/sessions/requests accrue without any extra polling.
   */
  stats?: typeof listenStatsService;
  /**
   * The timer every scheduling unit shares (backoff, track boundaries,
   * track-end refresh). Pumped on each native status frame and network edge
   * so its deadlines survive Android's background JS-timer freeze. Optional
   * for test fixtures, which get a private one.
   */
  timer?: PumpedTimer;
  /** Runs the 1 Hz JS fallback heartbeat (optional for test fixtures). */
  heartbeatDriver?: HeartbeatDriver;
  /** Called once teardown finished (releases the app-wide singleton). */
  onDestroyed?: () => void;
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
  /** Shared scheduling clock (see `PlayerServiceDependencies.timer`). */
  private readonly timer: PumpedTimer;
  /** Pending release of the paused stream's connection (see `PAUSE_RELEASE_MS`). */
  private readonly pauseRelease: PauseReleaseTimer;
  /**
   * The paused transport's connection was dropped (`releaseStream`): the
   * native player holds a placeholder, so its frames say nothing about the
   * stream's lag and any resume must re-open the source.
   */
  private streamReleased = false;
  /**
   * The system (not the user) paused the transport and has not resumed it
   * (see {@link AudioInterruption}). Diagnostics + the pause-release policy.
   */
  private interruption: AudioInterruption | null = null;
  /**
   * Date.now() of the last source (re-)open that has not produced audio yet,
   * 0 once audio flows — the in-flight connect guard (see `openInFlight`).
   */
  private lastOpenAt = 0;
  /** Date.now() of the last connectivity edge (lost / restored / handoff). */
  private lastNetworkEdgeAt = 0;
  /** Whether the JS fallback heartbeat is running (acts on change only). */
  private heartbeatRunning = false;
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
   * Consecutive watchdog windows the transport has spent in `connecting`.
   * Powers the escalation from "force a native start" (cheap, may not take)
   * to "re-open the source" (the only thing that heals a broken socket).
   */
  private connectingWindows = 0;
  /**
   * Date.now() of the last native status frame — ANY frame (buffering,
   * playing, paused, dead). Powers the silent-stall detector: while audio
   * flows the periodic time observer emits ~1 Hz, so a gap past
   * `SILENT_STALL_MS` means the playhead froze and native went quiet
   * (exactly what a background network death looks like — no frame at all).
   */
  private lastStatusAt: number = Date.now();
  /**
   * Whether the silent-stall detector has already reconciled the current
   * silent gap into `connecting`. One-shot per gap: a stall produces no
   * further frames until audio recovers, so without this latch the detector
   * would re-fire every heartbeat.
   */
  private silentStallHandled = true;
  /** Last native frame as `playbackState/timeControlStatus` — diagnostics. */
  private lastNativeSummary = "none";
  /**
   * Last decision the keepalive gate made — the gate only acts on change,
   * so reconcile-time calls never spam the native layer.
   */
  private keepaliveActive = false;
  /**
   * Whether the app UI is foregrounded. While backgrounded, store emissions
   * are suppressed so nothing reconciles in the hidden tree; the native
   * player and media session keep running. Restored emissions happen on the
   * way back to the foreground.
   */
  private appActive = true;
  /**
   * Monotonic command token. `play()`/`pause()`/`changeStream()` bump it, and
   * a `play()` that was overtaken while awaiting (session setup) aborts
   * instead of starting audio the user already cancelled.
   */
  private commandSeq = 0;
  /**
   * A `play()` is in flight and has not reached the transport yet. Counted as
   * play intent so a second tap in that window pauses instead of issuing a
   * second, competing play.
   */
  private pendingPlay = false;
  /** Date.now() when the native layer first reported a dead state, or null. */
  private deadSince: number | null = null;
  /** Date.now() until which the network is treated as suspect. */
  private networkSuspectUntil = 0;
  /** Consecutive reconnect attempts skipped because the network is offline. */
  private offlineSkips = 0;
  /** Last observed settle state — drives the "calculating" UI flip. */
  private syncSettled = false;

  constructor(private readonly deps: PlayerServiceDependencies) {
    this.timer = deps.timer ?? createPumpedTimer();
    this.pauseRelease = new PauseReleaseTimer(
      PAUSE_RELEASE_MS,
      () => this.releasePausedStream(),
      this.timer,
    );
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
          prefetchArtwork(this.deps, this.deps.repository.currentTrack);
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
    this.deps.networkMonitor.onLost = () => this.handleNetworkLost();
    this.deps.networkMonitor.onHandoff = () => this.handleNetworkHandoff();
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
    return this.pendingPlay || this.deps.state.isPlayingIntent;
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

  // ── Background-suspension keepalive ──

  /**
   * Keeps the audio session RENDERING while the app is backgrounded and the
   * user wants audio: a near-silent looping track at zero volume, so iOS
   * never suspends the app — outage or not.
   *
   * Why this is the load-bearing fix for the "music stops in a tunnel and
   * never comes back" report: iOS suspends a backgrounded app seconds after
   * it stops producing audio, and suspension freezes EVERYTHING — the JS
   * backoff timers, the NetInfo restore edge, even native status events.
   * Nothing on iOS re-runs JS when the network returns, so a suspended app
   * stays silent until the user manually reopens it.
   *
   * The gate is deliberately NOT keyed on "not playing": a background stall
   * stops the periodic time observer's frames entirely, so the state machine
   * can stay `playing` while the speaker is silent (the stall is detected
   * separately by the silent-stall detector). Keying the keepalive on the
   * state would repeat exactly that race — the previous attempt's bug. A
   * backgrounded session with play intent keeps the loop running: the
   * battery cost of a silent 8 kHz loop next to an active stream is noise,
   * and a user pause ends it (a suspended app is the correct outcome of a
   * deliberate pause).
   */
  private updateKeepalive(): void {
    const wanted = !this.appActive && this.deps.state.isPlayingIntent;
    if (wanted === this.keepaliveActive) return;
    this.keepaliveActive = wanted;
    if (wanted) {
      this.deps.audio.startKeepalive();
    } else {
      this.deps.audio.stopKeepalive();
    }
  }

  /**
   * Runs the 1 Hz JS fallback heartbeat while the app is visible or audio is
   * wanted, and stops it otherwise (paused + hidden: nothing to watch).
   *
   * Decided here rather than from the React store: background store
   * emissions are frozen, so a play started from the lock screen or the
   * notification while hidden never reached the store, and the silent-stall
   * detector never got its clock.
   */
  private updateHeartbeatDriver(): void {
    const driver = this.deps.heartbeatDriver;
    if (!driver) return;
    const wanted =
      !this.disposed &&
      this.initialized &&
      (this.appActive || this.isPlayingIntent);
    if (wanted === this.heartbeatRunning) return;
    this.heartbeatRunning = wanted;
    if (wanted) {
      driver.start(() => this.heartbeat());
    } else {
      driver.stop();
    }
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
    // The keepalive gate includes visibility: backgrounding with audio
    // wanted (but not flowing) starts the silent loop; foregrounding stops
    // it — a foregrounded app cannot be suspended.
    this.updateKeepalive();
    this.updateHeartbeatDriver();
    if (active) {
      this.deps.audible.adoptIfDue();
      this.emitPlayer();
      this.emitStation();
      this.emitProgress();
      // Post-suspension catch-up: iOS can suspend a backgrounded app during
      // an outage (no audio rendered). If the user then opens the app while
      // audio is still wanted but not flowing, reconnect NOW — the backoff
      // chain's pending timer is from before the suspension and may be
      // minutes away from firing, and a dead socket will never revive itself
      // (AVPlayer does not recover progressive streams on its own).
      if (this.deps.state.isPlayingIntent && this.deps.state.state !== "playing") {
        this.deps.reconnect.reset();
        void this.attemptReconnect("foreground: audio wanted but not flowing");
      } else if (
        this.deps.state.state === "playing" &&
        Date.now() - this.lastStatusAt >= SILENT_STALL_MS
      ) {
        // The suspension can also land while the state machine still claims
        // `playing` (the stall was invisible — no native frame ever arrived).
        // A `playing` label with no frame for this long is a label from
        // before the outage: fold it into the stall path and reconnect now.
        this.silentStallHandled = true;
        this.reconcile("connecting", "foreground: no native frame while 'playing'");
        this.deps.reconnect.reset();
        void this.attemptReconnect("foreground: stale 'playing'");
      } else {
        // Healthy (playing with a recent frame) or no audio wanted: nothing to repair.
      }
      // Re-arm the detector from NOW: the next real native frame re-syncs.
      this.lastStatusAt = Date.now();
      this.silentStallHandled = false;
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
    if (this.setupPromise) {
      await this.setupPromise;
      return;
    }
    if (this.initialized) return;

    const setup = this.runSetup().finally(() => {
      this.setupPromise = null;
    });
    this.setupPromise = setup;
    await setup;
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
      // Listen stats load lazily-and-once; recording waits for it.
      this.deps.stats?.initialize(),
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
    this.updateHeartbeatDriver();
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
    this.updateHeartbeatDriver();
    this.pauseRelease.cancel();
    this.userPaused = false;
    this.interruptionPending = false;
    this.stalledSince = null;
    this.setupPromise = null;
    this.connectingWindows = 0;
    this.commandSeq += 1;
    this.pendingPlay = false;
    this.deadSince = null;
    this.offlineSkips = 0;
    this.lastStatusAt = Date.now();
    this.silentStallHandled = true;
    // Close any open stats session before teardown (pending counts flush).
    this.deps.stats?.onPlaybackStopped();

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
      this.deps.onDestroyed?.();
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
      this.deps.onDestroyed?.();
    }
  }

  // ── Playback commands ──

  async play(): Promise<void> {
    this.pauseRelease.cancel();
    this.commandSeq += 1;
    const seq = this.commandSeq;
    // The user is choosing to play — an interruption that happens later is
    // no longer "resume the user's stream", it's a fresh intent.
    this.userPaused = false;

    // Already audible with a live transport: a duplicate play (double tap,
    // lock screen + UI) must not tear down and re-open a healthy stream.
    if (
      this.deps.state.state === "playing" &&
      Date.now() - this.lastStatusAt < SILENT_STALL_MS
    ) {
      return;
    }

    this.interruptionPending = false;
    this.interruption = null;
    this.stalledSince = null;
    this.connectingWindows = 0;
    this.lastStatusAt = Date.now();
    this.silentStallHandled = true;
    this.deadSince = null;
    this.offlineSkips = 0;
    // Latch the intent NOW: session setup below can take a beat, and a tap in
    // that window has to read "playing" (and pause), not start a second play.
    this.pendingPlay = true;
    this.updateHeartbeatDriver();
    this.emitPlayer();

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

      // Overtaken while the session was being set up (the user paused or
      // re-tuned): starting audio now would resurrect a cancelled play.
      if (seq !== this.commandSeq || this.disposed) return;

      // Fresh playback session: clear any reconnect state
      this.deps.reconnect.reset();
      // …and restart the heartbeat cadence (first native tick processes
      // immediately; the poll cycle counts from zero)
      this.deps.heartbeat.reset();

      // A long pause (or background suspension) leaves the retained lag stale:
      // the source below re-opens at the live edge, so re-lock the clock.
      // A short pause is seamless — the estimate is still fresh. A released
      // stream always re-measures: its last reading predates the release.
      if (
        this.streamReleased ||
        (this.deps.sync.hasMeasurement &&
          this.deps.sync.isStale(RESYNC_AFTER_MS))
      ) {
        this.reacquireSyncClock();
      }

      this.openSource("play");
      // Reconcile emits the store (isPlaying → true immediately) and
      // pushes "buffering" to the media session.
      this.reconcile("connecting", "user play");

      // Fetch fresh data + push metadata in one go
      await this.refreshData();
      await this.updateMetadata();
    } catch (error) {
      console.error("[PlayerService] Playback error:", error);
      throw error;
    } finally {
      if (seq === this.commandSeq) this.pendingPlay = false;
      this.updateHeartbeatDriver();
      this.emitPlayer();
      this.emitProgress();
    }
  }

  async pause(): Promise<void> {
    // Cancels any play() still setting up (see `commandSeq`).
    this.commandSeq += 1;
    this.pendingPlay = false;
    // The user explicitly paused: latch it so native self-recovery (focus
    // regain, interruption end) can never resurrect the stream.
    this.userPaused = true;
    this.interruptionPending = false;
    this.interruption = null;
    this.stalledSince = null;
    this.updateHeartbeatDriver();

    // Pausing only needs the audio transport — a failed/slow now-playing
    // fetch, or a media session that never started, must never make the
    // audio unpausable.
    if (!this.deps.audio.hasPlayer) return;
    if (this.deps.state.state === "paused") {
      // Native got there first (notification/lock-screen button pauses the
      // player before the JS command lands, or the OS paused it) — it is now
      // a user pause. Tell native too: it cancels any OS resume still
      // pending for that system pause (focus regain, interruption end).
      this.deps.audio.pause();
      this.armPauseRelease();
      return;
    }

    try {
      // User paused — stop any pending stream reconnects first
      this.deps.reconnect.cancel();

      this.deps.audio.pause();
      // Reconcile flips isPlayingIntent → false, emits the store and
      // pushes "paused" to the media session (the old flow pushed the
      // status manually and could leave the button latched).
      this.reconcile("paused", "user pause");
      this.pauseRelease.arm();
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

  /**
   * The single place a source is (re-)opened. `play` starts it; `load`
   * re-opens it while keeping the native play intent as it is — the safe
   * form for automatic re-opens of a stream the OS is currently playing: if
   * an interruption paused it in the meantime it stays paused, instead of
   * re-claiming audio focus / the audio session from the app that took it.
   */
  private openSource(
    mode: "play" | "load",
    url: string = this.deps.streamPreferences.current.url,
  ): void {
    this.lastOpenAt = Date.now();
    this.streamReleased = false;
    if (mode === "play") {
      this.deps.audio.play(url);
    } else {
      this.deps.audio.load(url);
    }
  }

  /** Re-opens the source a resumed/recovered stream is playing, at the live edge. */
  private reopenAtLiveEdge(cause: string): void {
    this.reacquireSyncClock();
    this.openSource("load");
    this.reconcile("connecting", cause);
    this.deps.heartbeat.beat();
  }

  /** Starts the pause-release countdown unless it runs or already released. */
  private armPauseRelease(): void {
    if (!this.streamReleased && !this.pauseRelease.isArmed) this.pauseRelease.arm();
  }

  /**
   * Pause-release deadline: drops the connection of a stream that is still
   * paused and that the OS will not resume on its own.
   */
  private releasePausedStream(): void {
    if (this.disposed || this.deps.state.state !== "paused") return;
    // The OS will resume it (focus regain / interruption end): keep it warm.
    if (!this.userPaused && this.interruption && isSelfResumingInterruption(this.interruption)) return;
    if (this.deps.audio.releaseStream()) {
      this.streamReleased = true;
      debugLog("[PlayerService] paused stream released");
    }
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

      this.openSource("load", stream.url);
      if (wasPlaying) {
        this.deps.audio.resume();
        // Reconcile: the notification follows the re-tune ("buffering")
        // instead of claiming the old stream is still playing.
        this.reconcile("connecting", "stream change");
      } else {
        // `load` re-opened the connection on a paused transport.
        this.pauseRelease.arm();
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
            () => {
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
    let positionSec: number | undefined;
    // Until the estimate settles the progress is a wall-clock guess —
    // withhold it (and, via `nowPlayingInput`, the seek bar) so the lock
    // screen does not show an unsynced position.
    if (this.deps.sync.settled) {
      // A freshly-announced track that is still buffered reports position 0:
      // the speaker is finishing the previous one and the OS seek bar must
      // not jump to the live point.
      positionSec = pending ? 0 : toSec(elapsedMs);
    }
    this.deps.media.push(
      this.getNowPlayingMetadata(),
      this.deps.state.remoteStatus,
      positionSec,
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
    if (this.disposed) return;
    this.deps.audible.adoptIfDue();
    this.runRecoveryChecks();
    this.deps.heartbeat.beat();
  }

  private get networkSuspect(): boolean {
    return Date.now() < this.networkSuspectUntil;
  }

  /**
   * Native reports a dead state (idle/failed/ended) ONCE, not every tick. If
   * that single frame landed inside {@link STREAM_DEATH_GRACE_MS} it was
   * ignored, and nothing would re-evaluate it — the transport sat in
   * `connecting` until the 12s watchdog. This re-checks on the 1 Hz clock.
   */
  private checkDeadStream(): void {
    if (
      this.deadSince == null ||
      !this.deps.state.isPlayingIntent ||
      this.deps.state.state !== "connecting"
    ) {
      return;
    }
    const now = Date.now();
    if (
      now - this.deps.state.enteredAt <= STREAM_DEATH_GRACE_MS ||
      now - this.deadSince < DEAD_LATCH_MS
    ) {
      return;
    }
    this.deadSince = null;
    this.scheduleReconnect("stream dead (latched)");
  }

  /**
   * Audio that was flowing stalled and the network is reachable: the socket is
   * dead, not slow, and the native player will never revive it. Re-open at the
   * live edge now rather than after the connecting watchdog's 12s.
   */
  private checkStallReopen(): void {
    if (
      this.stalledSince == null ||
      !this.deps.state.isPlayingIntent ||
      this.deps.state.state !== "connecting" ||
      !this.deps.networkMonitor.isOnline()
    ) {
      return;
    }
    const limit = this.networkSuspect
      ? SUSPECT_STALL_REOPEN_MS
      : STALL_REOPEN_ONLINE_MS;
    if (Date.now() - this.stalledSince < limit) return;
    void this.attemptReconnect("stall outlived the outage");
  }

  /**
   * The silent-stall detector. While the state machine claims `playing` and
   * the user wants audio, native frames are expected ~1 Hz; a gap past
   * `SILENT_STALL_MS` means the playhead froze and the periodic time
   * observer went quiet — the shape of a background network death, where NO
   * status (not even `isBuffering`) ever arrives.
   *
   * Reconciliation folds the invisible stall into the same path an explicit
   * buffering stall takes (`handleBuffering`): state → `connecting`, the
   * connecting watchdog armed — which escalates to a source re-open if
   * native never recovers — and the marker consumed so the one-shot cannot
   * loop. A later native frame re-arms the detector (`lastStatusAt` reset in
   * `handlePlaybackStatus`); recovery then flows through the ordinary
   * stall/live-edge logic.
   */
  private checkSilentStall(): void {
    if (
      this.silentStallHandled ||
      !this.deps.state.isPlayingIntent ||
      this.deps.state.state !== "playing"
    ) {
      return;
    }
    const limit = this.networkSuspect
      ? SUSPECT_SILENT_STALL_MS
      : SILENT_STALL_MS;
    if (Date.now() - this.lastStatusAt < limit) return;
    this.silentStallHandled = true;
    console.warn(
      "[PlayerService] no native status frame while 'playing' — treating as stall",
    );
    this.stalledSince = Date.now();
    this.reconcile("connecting", "silent stall: no native frame while 'playing'");
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
   *
   * `cause` feeds the dev-only transition trace: one structured line per
   * change with everything needed to replay a failure afterwards.
   */
  private reconcile(next: TransportState, cause: string): void {
    const from = this.deps.state.state;
    if (!this.deps.state.transition(next)) return;
    if (CONFIG.DEBUG) {
      logTransportTransition({
        from,
        to: next,
        cause,
        native: this.lastNativeSummary,
        online: this.deps.networkMonitor.isOnline(),
        suspect: this.networkSuspect,
        interruption: this.interruption,
        userPaused: this.userPaused,
        lagMs: this.deps.sync.delay,
        reconnectAttempt: this.deps.reconnect.attemptCount,
      });
    }
    // Listen stats ride the same transitions: entering `playing` anchors the
    // audible segment; pausing/idle closes the counting session. Brief
    // connecting/reconnecting hops do NOT split a session — the user's
    // listening continues across a stall.
    if (next === "playing") {
      this.deps.stats?.onPlaybackStarted();
    } else if (next === "paused" || next === "idle") {
      this.deps.stats?.onPlaybackStopped();
    } else {
      // connecting/reconnecting hops do not touch the stats session.
    }
    // Arm/disarm the "connecting" watchdog on the effective state.
    if (this.deps.state.state === "connecting") {
      this.connectingSince ??= Date.now();
    } else {
      this.connectingSince = null;
      this.connectingWindows = 0;
    }
    // Sampling follows play intent — the visualizer only runs with audio.
    this.deps.sampler.setPlaying(this.deps.state.isPlayingIntent);
    // The playing/paused intent is also part of the realtime-surface
    // battery policy: resuming playback re-opens the connection even when
    // the app stays hidden behind the lock screen.
    this.updateLiveStreamLifecycle();
    // The keepalive follows the same gate: while audio is wanted but not
    // flowing (underground, reconnecting) the silent loop must render so
    // iOS does not suspend the app mid-reconnect.
    this.updateKeepalive();
    this.updateHeartbeatDriver();
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

    // React Native suspends JS timers while an Android activity is in the
    // background, but native frames keep arriving — they fire every due
    // deadline (reconnect backoff, track boundary, pause release) too.
    this.timer.pump();

    // ANY native frame is proof the transport still ticks — re-arm the
    // silent-stall detector (see `checkSilentStall`). Must run before the
    // branches so even a "paused"/dead frame clears a pending stall.
    this.lastStatusAt = Date.now();
    this.silentStallHandled = false;
    this.lastNativeSummary = `${status.playbackState}/${status.timeControlStatus}${
      status.isBuffering ? "+buffering" : ""
    }`;
    // Re-set by `handleStreamLost` when this frame is itself a dead state.
    const priorDeadSince = this.deadSince;
    this.deadSince = null;

    // Feed the audible-clock estimate on EVERY native frame (including
    // buffering ones): the offset is what shifts progress, the countdown and
    // the media-session position back to what the speaker is producing. A
    // released stream's frames describe the placeholder, not the stream —
    // they would pin the estimate to its buffer.
    if (!this.streamReleased) {
      this.deps.sync.updateFromStatus({
        isLive: status.isLive ?? false,
        offsetFromLive: status.currentOffsetFromLive ?? null,
        bufferedAheadSeconds: status.bufferedAheadSeconds ?? null,
      });
    }
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

    if (CONFIG.DEBUG) {
      logSyncDebug(
        status,
        this.deps.sync,
        this.deps.audible.track ?? this.deps.repository.currentTrack,
      );
    }

    if (this.handleSystemPause(status)) return;
    if (!this.handleBuffering(status) && !this.handlePlaying(status) &&
        !this.handleNativelyPaused(status)) {
      this.handleStreamLost(status, priorDeadSince);
    }
    // Native frames are the only clock an Android app gets in the background
    // (JS timers are frozen; the patched player keeps a 1 Hz frame while
    // playback is wanted), so they run the same recovery checks as the JS
    // heartbeat. All of them are idempotent.
    this.runRecoveryChecks();
  }

  /**
   * The OS paused (or refused to start) the player — audio focus taken by
   * another app or a call, headphones gone, an iOS session interruption.
   * Checked before every other branch: such a frame can also report
   * `isBuffering` (a stream paused mid-buffer), and treating it as a stall
   * would make the reconnect logic take the audio straight back from the app
   * that just claimed it — the "press Play twice" bug.
   *
   * Adopted exactly once: the transport leaves the play-intent states, so
   * the reconnect chain, the watchdog and the stall detectors all stand
   * down. When the OS later resumes the player (focus regain, interruption
   * end with `shouldResume`), `handlePlaying` re-opens at the live edge; a
   * permanent loss stays paused until the user presses play.
   *
   * @returns true when the frame carried a system pause (handled here).
   */
  private handleSystemPause(status: AudioPlaybackStatus): boolean {
    const reason = status.interruption;
    if (!reason) {
      // A frame without a flag means the OS no longer holds the player.
      this.interruption = null;
      return false;
    }
    const first = this.interruption == null;
    this.interruption = reason;
    if (this.deps.state.isPlayingIntent) {
      this.deps.reconnect.cancel();
      this.stalledSince = null;
      // Whatever the OS resumes later is stale buffered audio: re-open then.
      this.interruptionPending = true;
      this.reconcile("paused", `system pause (${reason})`);
    }
    // A pause the OS will not undo keeps nothing worth a live connection.
    if (first && this.deps.state.state === "paused" && !isSelfResumingInterruption(reason)) {
      this.armPauseRelease();
    }
    return true;
  }

  /** The clock-driven recovery checks (JS heartbeat and native frames). */
  private runRecoveryChecks(): void {
    // Watchdog from either clock: native status events are the usual
    // watchdog clock, but a stall can leave them sparse (a dead socket has
    // no time progress to report) — the 1 Hz fallback must still escalate.
    this.enforceConnectingWatchdog();
    // Silence detection: a background stall stops native frames entirely
    // while the state machine still says `playing` — only the JS clock can
    // notice that (see `checkSilentStall`).
    this.checkSilentStall();
    // A dead native state that landed inside the death grace window, and a
    // stall that outlived the network outage, are both only visible to a clock.
    this.checkDeadStream();
    this.checkStallReopen();
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

    // Audio that was flowing just stalled — remember when, so a recovery
    // after the drift threshold can re-open at the live edge. Only arm from
    // `playing`: a stall while `connecting` is our own stream replace, not a
    // link that fell behind.
    if (this.deps.state.state === "playing") {
      this.stalledSince = Date.now();
      this.reconcile("connecting", "stall: native buffering");
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
        this.reopenAtLiveEdge(`stall recovered after ${stalledFor}ms`);
        return true;
      }
      // A short stall drained the buffer without a re-open: the lag moved by
      // the stall's length, so snap to the new reading instead of easing.
      this.deps.sync.requestRelock();
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
      // transient paused→playing frame leaves it clear. A released stream
      // is playing a placeholder and must be re-opened too.
      //
      // `load`, not `play`: it keeps whatever the OS decided — if another
      // interruption paused the player again before this frame was handled,
      // the re-open stays paused instead of re-claiming audio focus.
      if (this.interruptionPending || this.streamReleased) {
        this.interruptionPending = false;
        this.reopenAtLiveEdge("OS resumed after a system pause");
        return true;
      }
      // Otherwise adopt the resumed audio as-is (transient flap).
    }

    // Native 1 Hz heartbeat: drives progress + media-session pushes AND
    // the data poll while playing (see `HeartbeatScheduler`). These
    // events keep arriving while the app is backgrounded, where JS
    // timers freeze/throttle — without this, a live show's notification
    // keeps a stale title/cover forever.
    this.lastOpenAt = 0;
    this.reconcile("playing", "native: audio flowing");
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
      this.deps.heartbeat.beat();
      return true;
    }
    // A pause while audio was actually flowing is a real interruption
    // (call, focus loss) and must arm the live-edge re-open.
    if (this.deps.state.state === "playing") {
      this.interruptionPending = true;
    }
    this.reconcile("paused", "native paused");
    return true;
  }

  /**
   * Stream died while the user wants playback → schedule reconnect. The
   * grace window filters transient native idle states (`replace()`).
   */
  private handleStreamLost(
    status: AudioPlaybackStatus,
    priorDeadSince: number | null,
  ): void {
    if (
      !this.deps.state.isPlayingIntent ||
      status.isBuffering ||
      !isDeadPlaybackState(status.playbackState)
    ) {
      return;
    }
    if (Date.now() - this.deps.state.enteredAt > STREAM_DEATH_GRACE_MS) {
      this.scheduleReconnect(`stream dead (${status.playbackState})`);
    } else {
      // Inside the grace window: remember it so the heartbeat can re-check
      // once the window closes (native will not repeat the frame).
      this.deadSince = priorDeadSince ?? Date.now();
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
    // Restart the clock so a failed retry waits another full window.
    this.connectingSince = Date.now();
    // No link: nudging or re-opening native cannot help and only churns it.
    // Park in `reconnecting` with a backoff probe; the restore edge (or the
    // probe) brings it back.
    if (!this.deps.networkMonitor.isOnline()) {
      this.scheduleReconnect("stuck connecting while offline");
      return;
    }
    this.connectingWindows += 1;
    // Escalation: the first windows only force a native start (cheap), but
    // a broken socket can sit in "waiting" forever with `resume()` doing
    // nothing — AVPlayer never recovers a progressive stream on its own.
    // Past CONNECTING_REOPEN_WINDOWS the source is re-opened, the only action
    // that heals the connection — through the backoff, so a link that is up
    // but too slow for the stream is retried 2s, 4s … 30s apart instead of
    // having every slow-but-progressing connect torn down at a fixed 12s
    // cadence. The attempt in flight keeps loading meanwhile; audio resets it.
    if (this.connectingWindows >= CONNECTING_REOPEN_WINDOWS) {
      this.connectingWindows = 0;
      this.scheduleReconnect("stuck connecting");
      return;
    }
    console.warn(
      "[PlayerService] transport stuck connecting — forcing native start",
    );
    this.deps.audio.resume();
  }

  /** Bookkeeping shared by every connectivity edge. */
  private onNetworkEdge(): void {
    this.timer.pump();
    this.lastNetworkEdgeAt = Date.now();
    this.networkSuspectUntil = Date.now() + NETWORK_SUSPECT_MS;
  }

  private handleNetworkLost(): void {
    if (this.disposed) return;
    // Do NOT touch native: the forward buffer keeps playing through a short
    // tunnel, and tearing it down would make the outage audible immediately.
    this.onNetworkEdge();
  }

  /**
   * Wi-Fi ↔ cellular: the link never reports offline, but the stream's TCP
   * socket dies with the old route. The buffer keeps playing until it drains,
   * so leave it alone and just make the stall/silence detectors eager.
   */
  private handleNetworkHandoff(): void {
    if (this.disposed) return;
    this.onNetworkEdge();
    this.deps.sync.requestRelock();
    if (
      this.deps.state.isPlayingIntent &&
      this.deps.state.state !== "playing"
    ) {
      this.deps.reconnect.reset();
      void this.attemptReconnect("network handoff");
    }
  }

  private handleNetworkRestore(): void {
    if (this.disposed) return;

    // Instant reconnect instead of waiting the backoff out
    this.onNetworkEdge();
    this.deps.reconnect.reset();
    this.offlineSkips = 0;

    if (this.deps.state.isPlayingIntent) {
      // Still audibly playing from the buffer that rode out the outage with a
      // live transport: keep it — re-opening now would only add a gap. If the
      // socket did die, the stall path (eager while the network is suspect)
      // re-opens as soon as the buffer drains.
      const flowing =
        this.deps.state.state === "playing" &&
        Date.now() - this.lastStatusAt < SUSPECT_SILENT_STALL_MS;
      if (!flowing) {
        // The link came back — a stale stall marker must not double-re-open.
        this.stalledSince = null;
        void this.attemptReconnect("network restored");
      }
    }

    // Refresh all API data (track, program, listeners, history)
    this.refreshData().catch(console.error);
  }

  // ── Reconnect chain ──

  private scheduleReconnect(reason: string): void {
    if (this.deps.reconnect.isPending) return;

    // Reconcile: the notification leaves "playing" the moment the stream
    // is lost (it used to stay stale until the next track change).
    this.reconcile("reconnecting", reason);

    // Exponential backoff: 2s → 4s → 8s → 16s → 30s (cap)
    const delay = this.deps.reconnect.schedule(() => {
      void this.attemptReconnect("backoff elapsed").catch(console.error);
    });

    console.warn(
      `[PlayerService] ${reason} — reconnecting in ${delay}ms (attempt ${this.deps.reconnect.attemptCount}, online=${this.deps.networkMonitor.isOnline()})`,
    );
  }

  /**
   * Whether a source open is already in flight and still worth waiting for:
   * no audio yet, issued after the latest connectivity change and younger
   * than one watchdog window. Every automatic trigger (stall, foreground catch-up,
   * watchdog, network edges) funnels into `attemptReconnect`; without this,
   * two of them landing together re-opened twice and the second aborted the
   * first connect mid-handshake. An open issued before a network edge rode
   * the old route and is never protected.
   */
  private get openInFlight(): boolean {
    return (
      this.deps.state.state === "connecting" &&
      this.lastOpenAt > 0 &&
      this.lastOpenAt > this.lastNetworkEdgeAt &&
      Date.now() - this.lastOpenAt < CONNECTING_WATCHDOG_MS
    );
  }

  /**
   * Reconnects to the live stream: replaces the audio source (which
   * re-opens the connection at the current live point — there is no
   * gapless resume on a radio stream) and resumes playback.
   */
  private async attemptReconnect(reason: string): Promise<void> {
    if (!this.deps.state.isPlayingIntent || !this.deps.audio.hasPlayer) {
      return;
    }
    if (this.openInFlight) {
      debugLog(`[PlayerService] reconnect (${reason}) skipped — open in flight`);
      return;
    }

    // Offline: re-opening cannot succeed and would reset the sync clock for
    // nothing. Keep the backoff ticking (as `reconnecting`) and probe every
    // few skips in case the OS connectivity reading is stale.
    if (
      !this.deps.networkMonitor.isOnline() &&
      this.offlineSkips < OFFLINE_PROBE_EVERY
    ) {
      this.offlineSkips += 1;
      this.scheduleReconnect(`offline (${reason})`);
      return;
    }
    this.offlineSkips = 0;

    console.warn(`[PlayerService] re-opening source: ${reason}`);
    try {
      // Reconnect re-opens live anyway — drop any pending interruption.
      this.interruptionPending = false;
      this.stalledSince = null;
      // The source is re-opened: re-lock the audible clock.
      this.reacquireSyncClock();
      this.openSource("play");
      // Reconcile pushes "buffering" — no manual pushStatus needed.
      this.reconcile("connecting", `reconnect: ${reason}`);
    } catch (error) {
      console.error("[PlayerService] Reconnect attempt failed:", error);
      this.scheduleReconnect("reconnect attempt threw");
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
   * The displayed (audible) track changed — either the station announced a
   * track that is already audible, or a deferred one just crossed into the
   * speaker. Emits the now-playing UI, the progress store and the media
   * session so title, cover, lock screen and seek bar all move together.
   */
  private handleDisplayedTrackChange(): void {
    // A new track reached the speaker — count it if audio is flowing (a
    // track announced/adopted while paused was not actually heard).
    this.deps.stats?.onTrackHeard(
      this.deps.audible.track,
      this.deps.state.state === "playing",
    );
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
