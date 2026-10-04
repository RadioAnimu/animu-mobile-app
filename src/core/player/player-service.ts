import type { HistoryType } from "animu-api";
import type { MediaMetadata, PlaybackState, PlayerStatus } from "react-native-airwave";
import type { Stream } from "@/core/domain/stream";
import { userSettingsService } from "@/core/services/user-settings.service";
import type { listenStatsService } from "@/core/services/listen-stats.service";
import { animuApi } from "@/api/client";
import { CONFIG, debugLog } from "@/utils/player.config";
import type { AudioPlayer, NowPlayingMetadata } from "@/core/player/ports";
import { buildNowPlayingMetadata } from "@/core/player/media-session/now-playing.metadata";
import { pickPreviewArtwork, type ArtworkResolver } from "@/core/player/storage/artwork";
import type { HeardTrack } from "@/core/player/stream-playback/heard-track";
import type { NowPlayingRepository } from "@/core/player/stream-playback/now-playing.repository";
import type { StreamPreferences } from "@/core/player/stream-playback/stream-preferences";
import {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type StationSnapshot,
  type TransportState,
} from "@/core/player/store";
import type { VisualizerSampler, VisualizerWindow } from "@/core/player/visualizer/types";
import { prefetchArtwork } from "@/core/player/artwork-prefetch";

/** API data refresh cadence while audio is wanted / paused (foreground). */
const POLL_PLAYING_MS = 5_000;
const POLL_PAUSED_MS = 30_000;

/** Runs `tick` about once a second while started (foreground UI only). */
export interface Ticker {
  start(tick: () => void): void;
  stop(): void;
}

export interface PlayerServiceDependencies {
  player: AudioPlayer;
  repository: NowPlayingRepository;
  streamPreferences: StreamPreferences;
  artwork: ArtworkResolver;
  heard: HeardTrack;
  sampler: VisualizerSampler;
  /** On-device listen stats (optional for test fixtures). */
  stats?: typeof listenStatsService;
  /** Foreground 1 Hz ticker: progress store, data polls, listen-stats segments. */
  ticker: Ticker;
  /** Called once teardown finished (releases the app-wide singleton). */
  onDestroyed?: () => void;
}

/** Airwave's playback state → the UI's transport vocabulary. */
const TRANSPORT: Record<PlaybackState, TransportState> = {
  idle: "idle",
  stopped: "idle",
  loading: "connecting",
  buffering: "connecting",
  playing: "playing",
  paused: "paused",
  reconnecting: "reconnecting",
  ended: "paused",
  error: "paused",
};

/**
 * The app's player: Rádio Animu's streams on react-native-airwave, with the
 * station's own now-playing data on top.
 *
 * Airwave owns playback natively — the state machine, reconnects, stall and
 * network recovery, live-edge resumes, audio focus, interruptions, the lock
 * screen and its remote commands, background keepalive. This class does what
 * only the app knows:
 *
 * - which stream to play (user preference, bitrate picker);
 * - what is on air (`NowPlayingRepository`: SSE + HTTP, history, listeners);
 * - what is *heard* (`HeardTrack`: the station's track matching the audible
 *   ICY title) and how far into it — shown in the UI and on the lock screen,
 *   where Airwave advances the song's progress natively;
 * - cover art (local cache), the visualizer, listen stats.
 *
 * It is the single writer of the React stores.
 */
export class PlayerService {
  private streamOptions: Stream[] = [];
  private initialized = false;
  private setupPromise: Promise<void> | null = null;
  private disposed = false;
  private appActive = true;
  /** A `play()` that has not reached the player yet counts as play intent. */
  private pendingPlay = false;
  /** The stream the player has loaded (id), or null before the first play. */
  private loadedStreamId: string | null = null;
  /** The next audible ICY title follows a (re)open: it is already partway. */
  private tuneIn = true;
  private lastPollAt = 0;
  private lastState: PlaybackState = "idle";
  private readonly unsubscribe: (() => void)[] = [];

  constructor(private readonly deps: PlayerServiceDependencies) {
    const { player, repository, heard } = deps;
    this.unsubscribe.push(
      player.on("status", (status) => this.handleStatus(status)),
      player.on("metadata", (metadata) => this.handleStreamMetadata(metadata)),
      // Play from Control Center / the lock screen before anything is loaded
      // (iOS relaunched the app in the background for it). Airwave handles
      // every later command natively; this one only the app can answer.
      player.on("remoteCommand", ({ command }) => {
        if (command !== "play" && command !== "togglePlayPause") return;
        if (this.loadedStreamId != null) return;
        void this.setupPlayer()
          .then(() => this.play())
          .catch((error) => console.warn("[PlayerService] remote play:", error));
      }),
    );
    heard.onChange = () => this.handleDisplayedTrackChange();
    heard.onUnknownTitle = (title) => {
      // Event-driven, no timer: a stuck refresh is expired by time, then one
      // HTTP fetch names the track (the SSE may be down in the background).
      repository.expireStuckRefresh();
      void this.refreshData()
        .catch((error) => console.warn("[PlayerService] refresh for heard title:", error))
        .finally(() => heard.unresolved(title));
    };
    repository.onChange = (change) => {
      if (change.trackChanged) {
        // Announced a stream-lag ahead of the speaker: warm its cover now.
        prefetchArtwork(
          { artwork: deps.artwork, isOnline: () => player.status.network !== "offline" },
          repository.currentTrack,
        );
        heard.stationChanged();
      }
      if (change.programChanged) this.emitPlayer();
      if (change.listenersChanged || change.playedChanged || change.requestedChanged) {
        this.emitStation();
      }
    };
  }

  // ── Queries ──

  get isPlayingIntent(): boolean {
    return this.pendingPlay || this.deps.player.status.playWhenReady;
  }

  /** A track is known (the UI can render the player). */
  get isReady(): boolean {
    return !this.disposed && this.deps.repository.hasTrack;
  }

  /**
   * Lock-screen fields. The cover is always a **local file** — the one the
   * app's own cover cache downloaded (shared with expo-image), else the
   * bundled default until it lands — so the media session never downloads a
   * cover a second time. Airwave reads the file in-process on both platforms.
   */
  getNowPlayingMetadata(): NowPlayingMetadata {
    const { artwork } = this.deps;
    const meta = buildNowPlayingMetadata({
      track: artwork.apply(this.deps.heard.track),
      isLive: this.deps.repository.currentProgram?.isLive ?? false,
      showProgress: this.deps.repository.showProgress && this.deps.heard.anchored,
      defaultCover: artwork.defaultCover,
    });
    if (!meta.artwork || artwork.isRemote(meta.artwork)) meta.artwork = artwork.defaultCover;
    return meta;
  }

  peekArtwork(url: string): string | undefined {
    return this.deps.artwork.peek(url);
  }

  /** Local cover file for `url` (a low-res preview first, when one is listed). */
  resolveArtwork(
    url: string,
    onPreview?: (local: string) => void,
    previewUrl?: string | null,
  ): Promise<string> {
    return this.deps.artwork.resolve(url, onPreview, previewUrl);
  }

  get defaultArtwork(): string {
    return this.deps.artwork.defaultCover;
  }

  // ── Visualizer ──

  get isVisualizerSupported(): boolean {
    return this.deps.sampler.isSupported;
  }

  setVisualizerEnabled(enabled: boolean): void {
    this.deps.sampler.setEnabled(enabled);
  }

  subscribeVisualizerWindows(listener: (window: VisualizerWindow) => void): () => void {
    return this.deps.sampler.subscribeWindows(listener);
  }

  reportVisualizerDelay(appliedMs: number): void {
    this.deps.sampler.reportAppliedDelay?.(appliedMs);
  }

  setVisualizerSyncTrim(trimMs: number): void {
    this.deps.sampler.setSyncTrim?.(trimMs);
  }

  // ── Lifecycle ──

  /**
   * Realtime (SSE) battery policy: keep it while the app is visible, while
   * audio is wanted, or when the user opted to always keep live updates.
   */
  updateLiveStreamLifecycle(): void {
    const always = userSettingsService.getCurrentSettings().liveUpdatesInBackground;
    this.deps.repository.setLiveStreamActive(always || this.appActive || this.isPlayingIntent);
  }

  /**
   * App visibility. Hidden: no store writes (the tree is frozen), no ticker,
   * no visualizer — audio and the lock screen keep going natively.
   */
  setAppActive(active: boolean): void {
    if (this.appActive === active) return;
    this.appActive = active;
    this.deps.sampler.setForeground(active);
    this.updateLiveStreamLifecycle();
    this.updateTicker();
    if (active) {
      this.emitPlayer();
      this.emitStation();
      this.emitProgress();
    }
  }

  /** Streams, preferences, settings and the first data fetch. Idempotent. */
  async setupPlayer(): Promise<void> {
    if (!this.setupPromise && !this.initialized) {
      this.setupPromise = this.runSetup().finally(() => {
        this.setupPromise = null;
      });
    }
    await this.setupPromise;
  }

  private async runSetup(): Promise<void> {
    const [streams] = await Promise.all([
      animuApi.getStreams(),
      userSettingsService.initialize(),
      this.deps.artwork.init(),
      this.deps.stats?.initialize(),
    ]);
    if (this.disposed) return;
    this.streamOptions = streams;
    this.deps.sampler.setEnabled(userSettingsService.getCurrentSettings().visualizerHz > 0);
    this.updateLiveStreamLifecycle();
    await this.deps.streamPreferences.load(streams);
    if (this.disposed) return;
    try {
      await this.refreshData();
    } catch (error) {
      console.warn("[PlayerService] setupPlayer: initial data fetch failed:", error);
    }
    if (this.disposed) return;
    this.initialized = true;
    this.updateTicker();
    this.emitPlayer();
    this.emitProgress();
  }

  /** Releases the player and every unit. Safe at any stage; one-way. */
  async destroy(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.deps.ticker.stop();
    this.deps.stats?.onPlaybackStopped();
    this.unsubscribe.forEach((off) => off());
    this.deps.sampler.dispose();
    this.deps.repository.dispose();
    this.deps.repository.clear();
    this.deps.artwork.reset();
    this.deps.heard.reset();
    this.deps.streamPreferences.reset();
    try {
      await this.deps.player.release();
    } catch (error) {
      console.error("[PlayerService] release failed:", error);
    }
    this.initialized = false;
    this.streamOptions = [];
    playerStore.setSnapshot({
      isPlaying: false,
      playbackState: "idle",
      isInitialized: false,
      syncing: false,
    });
    this.emitStation();
    this.emitProgress();
    this.deps.onDestroyed?.();
  }

  // ── Commands ──

  async play(): Promise<void> {
    if (this.disposed) return;
    this.pendingPlay = true;
    this.emitPlayer();
    try {
      if (this.streamOptions.length) await this.deps.streamPreferences.restore(this.streamOptions);
      const stream = this.deps.streamPreferences.current;
      if (this.loadedStreamId !== stream.id) {
        await this.open(stream, true);
      } else {
        // Airwave resumes in place, or re-opens at the live edge after a long
        // pause — either way the next title (if any) is reported by status.
        await this.deps.player.play();
      }
      void this.refreshData().catch((error) => console.warn("[PlayerService] refresh:", error));
    } catch (error) {
      console.error("[PlayerService] Playback error:", error);
      throw error;
    } finally {
      this.pendingPlay = false;
      this.updateTicker();
      this.emitPlayer();
    }
  }

  async pause(): Promise<void> {
    this.pendingPlay = false;
    if (this.disposed) return;
    await this.deps.player.pause();
    this.updateTicker();
    this.emitPlayer();
  }

  async changeStream(stream: Stream): Promise<void> {
    if (this.deps.streamPreferences.current.id === stream.id) return;
    await this.deps.streamPreferences.set(stream);
    // Re-tune only a loaded player; otherwise the next play() opens it.
    if (this.loadedStreamId != null) await this.open(stream, this.isPlayingIntent);
    this.emitPlayer();
  }

  /** Opens `stream` (a different relay buffers differently: re-lock the position). */
  private async open(stream: Stream, autoplay: boolean): Promise<void> {
    this.loadedStreamId = stream.id;
    this.tuneIn = true;
    this.deps.heard.useStream(stream.id);
    this.deps.heard.reopened();
    try {
      await this.deps.player.load(
        {
          uri: stream.url,
          live: true,
          headers: { "User-Agent": CONFIG.USER_AGENT },
          metadata: this.getNowPlayingMetadata(),
        },
        { autoplay },
      );
    } catch (error) {
      // Recoverable failures keep reconnecting natively; the status tells the UI.
      console.warn("[PlayerService] load:", error);
    }
  }

  // ── Data ──

  async refreshData(): Promise<boolean> {
    this.lastPollAt = Date.now();
    return this.deps.repository.refresh();
  }

  async refreshHistory(type: HistoryType): Promise<void> {
    await this.deps.repository.refreshHistory(type);
  }

  // ── Native events ──

  private handleStatus(status: PlayerStatus): void {
    const previous = this.lastState;
    this.lastState = status.state;
    const playing = status.state === "playing";
    if (playing !== (previous === "playing")) {
      if (playing) this.deps.stats?.onPlaybackStarted();
      else this.deps.stats?.onPlaybackStopped();
    }
    // A (re)open — reconnect, live-edge resume, stream change: the next title
    // reported is a tune-in.
    const reopening = status.state === "loading" || status.state === "reconnecting";
    if (reopening && !this.tuneIn) {
      this.tuneIn = true;
      this.deps.heard.reopened();
    }
    this.deps.heard.setRunning(playing);
    this.deps.sampler.setPlaying(playing);
    this.updateLiveStreamLifecycle();
    this.updateTicker();
    this.emitPlayer();
    this.emitProgress();
  }

  /** An ICY title became audible (Airwave reports it when heard). */
  private handleStreamMetadata(metadata: MediaMetadata): void {
    const title = metadata.raw?.StreamTitle;
    if (!title) return;
    const tuneIn = this.tuneIn;
    this.tuneIn = false;
    // How far the speaker trails the live edge right now (places a tune-in;
    // at a change it lets the stream learn its ICY offset).
    const progress = this.deps.player.getProgress();
    const lagMs = (progress.liveOffset ?? progress.bufferedAhead) * 1000;
    debugLog(
      `[PlayerService] heard "${title}" tuneIn=${tuneIn} lag=${Math.round(lagMs)}ms icyOffset=${Math.round(this.deps.heard.icyOffsetMs)}ms`,
    );
    this.deps.heard.heard(title, metadata.timestamp, tuneIn, lagMs);
  }

  /**
   * The displayed track changed (heard, or the station's before anything was
   * heard): UI, progress, lock screen and stats move together.
   */
  private handleDisplayedTrackChange(): void {
    if (this.deps.heard.anchored) {
      this.deps.stats?.onTrackHeard(this.deps.heard.track, this.lastState === "playing");
    }
    this.tickStats();
    this.emitPlayer();
    this.emitProgress();
    this.updateNowPlaying();
  }

  /**
   * Lock screen: title/artist/cover, and the song's progress when known —
   * Airwave advances it natively while audio plays. The cover is published
   * as soon as it is cached locally (a low-res sibling first).
   */
  private updateNowPlaying(): void {
    if (this.loadedStreamId == null) return;
    this.pushNowPlaying();
    const track = this.deps.heard.track;
    const url = track?.artwork;
    if (!track || !url || !this.deps.artwork.isRemote(url) || this.deps.artwork.peek(url)) return;
    const stillCurrent = () => this.deps.heard.track?.artwork === url;
    void this.deps.artwork
      .resolve(
        url,
        () => {
          if (stillCurrent()) {
            this.pushNowPlaying();
            this.emitPlayer();
          }
        },
        pickPreviewArtwork(url, track.artworks),
      )
      .then(() => {
        if (!stillCurrent()) return;
        this.pushNowPlaying();
        // Hand the UI the local file too (no second download of the cover).
        this.emitPlayer();
      });
  }

  private pushNowPlaying(): void {
    const meta = this.getNowPlayingMetadata();
    const elapsed = this.deps.heard.elapsedMs();
    void this.deps.player
      .updateNowPlaying({
        title: meta.title,
        artist: meta.artist,
        artwork: meta.artwork,
        ...(meta.durationSec && elapsed != null
          ? { duration: meta.durationSec, elapsed: elapsed / 1000 }
          : {}),
      })
      .catch((error) => console.warn("[PlayerService] now playing:", error));
  }

  // ── Foreground ticker ──

  private updateTicker(): void {
    if (!this.disposed && this.initialized && this.appActive) {
      this.deps.ticker.start(() => this.tick());
    } else {
      this.deps.ticker.stop();
    }
  }

  private tick(): void {
    if (this.disposed) return;
    this.tickStats();
    this.emitProgress();
    this.deps.repository.expireStuckRefresh();
    const cadence = this.isPlayingIntent ? POLL_PLAYING_MS : POLL_PAUSED_MS;
    if (Date.now() - this.lastPollAt >= cadence) {
      void this.refreshData().catch((error) => {
        if (CONFIG.DEBUG) console.warn("[PlayerService] poll:", error);
      });
    }
  }

  /**
   * Listen stats close [anchor, now) segments: ticked on every displayed
   * track, state change and foreground second — no background heartbeat.
   */
  private tickStats(): void {
    if (this.lastState === "playing") this.deps.stats?.onAudibleTick(Date.now());
  }

  // ── Stores (single writer) ──

  private emitPlayer(): void {
    if (!this.appActive) return;
    const next: PlayerSnapshot = {
      currentTrack: this.deps.artwork.apply(this.deps.heard.track) ?? undefined,
      currentProgram: this.deps.repository.currentProgram ?? undefined,
      currentStream: this.deps.streamPreferences.current,
      streamOptions: this.streamOptions,
      isPlaying: this.isPlayingIntent,
      playbackState: this.pendingPlay ? "connecting" : TRANSPORT[this.deps.player.status.state],
      isInitialized: this.initialized,
      // Audio wanted but no title heard since the source opened: the position
      // is not known yet ("calculating" in the header / countdown).
      syncing: this.isPlayingIntent && !this.deps.heard.anchored,
    };
    playerStore.setSnapshot(next);
  }

  private emitStation(): void {
    if (!this.appActive) return;
    const { repository } = this.deps;
    const next: StationSnapshot = {
      currentListeners: repository.listeners ?? undefined,
      lastPlayedTracks: repository.lastPlayedTracks.length ? repository.lastPlayedTracks : undefined,
      lastRequestedTracks: repository.lastRequestedTracks.length
        ? repository.lastRequestedTracks
        : undefined,
    };
    stationStore.setSnapshot(next);
  }

  private emitProgress(): void {
    if (!this.appActive) return;
    progressStore.setSnapshot({
      currentTrackProgress: this.deps.heard.elapsedMs(),
      showProgress: this.deps.repository.showProgress,
    });
  }
}
