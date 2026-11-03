import type { HistoryType } from "animu-api";
import { Platform } from "react-native";
import type { MediaMetadata, PlaybackState, PlayerStatus } from "react-native-anything-player";
import type { Stream } from "@/core/domain/stream";
import { isRealTrack, type Track } from "@/core/domain/track";
import { userSettingsService } from "@/core/services/user-settings.service";
import type { listenStatsService } from "@/core/services/listen-stats.service";
import { animuApi } from "@/api/client";
import { CONFIG, debugLog } from "@/utils/player.config";
import type { AudioPlayer, NowPlayingMetadata } from "@/core/player/ports";
import { buildNowPlayingMetadata } from "@/core/player/media-session/now-playing.metadata";
import { pickPreviewArtwork, type ArtworkResolver } from "@/core/player/storage/artwork";
import { BackgroundIdle } from "@/core/player/stream-playback/background-idle";
import type { HeardTrack } from "@/core/player/stream-playback/heard-track";
import { positionAt, type NowHearing } from "@/core/player/stream-playback/now-hearing";
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
  /** ICY titles in: what the stream says is heard. */
  heard: HeardTrack;
  /** What is heard and how far into it (ICY, or the audible clock without it). */
  hearing: NowHearing;
  sampler: VisualizerSampler;
  /** On-device listen stats. */
  stats: typeof listenStatsService;
  /** Foreground 1 Hz ticker: progress store, data polls, listen-stats segments. */
  ticker: Ticker;
  /** Called as teardown starts (frees the app-wide singleton for a replacement). */
  onDestroyed?: () => void;
  /** The station announced a track, heard a stream lag later: warm up for it (lyrics). */
  onTrackAnnounced?: (track: Track | null) => void;
  /** A live song's length from the lyrics database (ms), or `null`. Display only. May reject. */
  estimateDuration?: (track: Track) => Promise<number | null>;
  /** Stores the station for voice requests and car picks (`setCatalog`). May reject. */
  publishCatalog?: (streams: Stream[], current: Stream) => Promise<void>;
}

// Safari and Firefox send a User-Agent as a CORS-preflighted header the stream
// server refuses: the fetch fails (no metadata, no oscilloscope). Chrome drops it.
const STREAM_HEADERS: Record<string, string> = Platform.OS === "web" ? {} : { "User-Agent": CONFIG.USER_AGENT };

/**
 * What the player loads for `stream`: every relay as a rendition of one live
 * source, so a quality change has no gap. A stream outside the fetched list
 * (the fallback) plays on its own.
 */
export const streamSource = (streams: Stream[], stream: Stream) => {
  const renditions = streams.some((option) => option.id === stream.id) ? streams : [];
  return {
    uri: stream.url,
    ...(renditions.length > 0 && {
      renditions: renditions.map((option) => ({
        id: option.id,
        uri: option.url,
        bitrate: option.bitrate * 1_000,
      })),
    }),
    live: true,
    headers: STREAM_HEADERS,
  };
};

/** The heard song's position, read on demand (the lyrics clock samples it). */
export interface HeardPosition {
  /** `raw` of the heard track, to match it to what the UI shows. */
  raw: string;
  /** Elapsed ms into the track at the moment of the call. */
  elapsedMs: number;
  /** Advances with the wall clock (audio flowing, or the station's live point); stops at the end. */
  advancing: boolean;
}

/** A song's identity for its duration estimate: a replay of a title is a new song. */
const estimateKey = (track: Track): string => `${track.raw}|${track.startTime.getTime()}`;

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
 * The app's player. Airwave (react-native-anything-player) owns playback
 * natively: reconnects, live-edge resumes, audio focus, the lock screen and its
 * commands. This class adds what only the app knows — which stream, what is on
 * air (`NowPlayingRepository`), what is heard and how far in (`NowHearing`),
 * cover art, the visualizer, listen stats — and is the single writer of the
 * React stores.
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
  /** The streams loaded as renditions: a switch among them has no gap. */
  private loadedRenditionIds: string[] = [];
  /** The rendition playing (`status.quality`). */
  private playingQuality: string | null = null;
  /** The next audible ICY title follows a (re)open: it is already partway. */
  private tuneIn = true;
  private lastPollAt = 0;
  private lastState: PlaybackState = "idle";
  /** Hidden with no audio wanted — the clock behind the realtime-connection deadline. */
  private readonly backgroundIdle = new BackgroundIdle();
  /** The previous evaluation saw the app idle: leaving it is a "return" (catch up). */
  private wasIdle = false;
  /** A track change skipped the lyrics prefetch while idle; the return does it. */
  private lyricsSkipped = false;
  /**
   * A live song's length from its lyrics, for a real song the station sends no
   * duration for; `ms` is `null` while pending or not found. DISPLAY only: the
   * station's `duration` drives the sync — a TV-size row (1:30) against a full
   * cut on air (4:00) must not end the lyrics at 1:30.
   */
  private durationEstimate: { key: string; ms: number | null } | null = null;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(private readonly deps: PlayerServiceDependencies) {
    const { player, repository, heard, hearing } = deps;
    this.unsubscribe.push(
      player.on("status", (status) => this.handleStatus(status)),
      player.on("metadata", (metadata) => this.handleStreamMetadata(metadata)),
      player.on("discontinuity", () => this.handleDiscontinuity()),
      // A voice request or a car pick played the station natively.
      player.on("searchPlay", () => this.adoptNativeLoad()),
      // A gapless switch that failed keeps the old relay playing: re-open the pick.
      player.on("error", (error) => {
        if (error.code !== "QUALITY_SWITCH_FAILED") return;
        const stream = this.deps.streamPreferences.current;
        if (this.loadedStreamId !== stream.id || this.playingQuality === stream.id) return;
        void this.open(stream, this.isPlayingIntent);
      }),
      // Native-timer readings while playing: they run JS where JS timers are
      // frozen (Android background) — the audible clock, stats, watchdogs.
      player.on("progress", (reading) => {
        hearing.progress(reading);
        this.tickStats();
        repository.expireStuckRefresh();
        repository.tickLive();
      }),
      // Play from the lock screen before anything is loaded (iOS relaunched the
      // app for it): the one command Airwave cannot answer natively.
      player.on("remoteCommand", ({ command }) => {
        if (command !== "play" && command !== "togglePlayPause") return;
        if (this.loadedStreamId != null) return;
        void this.setupPlayer()
          .then(() => this.play())
          .catch((error: unknown) => console.warn("[PlayerService] remote play:", error));
      }),
    );
    heard.onChange = () => this.handleDisplayedTrackChange();
    hearing.onChange = () => this.handleDisplayedTrackChange();
    heard.onUnknownTitle = (title) => {
      // No timer: one HTTP fetch names the track (the SSE may be down in the
      // background, or have missed the item).
      repository.expireStuckRefresh();
      void this.refreshData({ forceMetadata: true })
        .catch((error: unknown) => console.warn("[PlayerService] refresh for heard title:", error))
        .finally(() => heard.unresolved(title));
    };
    // The deadline is enforced where JS runs in the background: the SSE events.
    repository.shouldStayLive = () => this.updateLiveStreamLifecycle();
    repository.isQuiet = () => this.isQuiet;
    // A cover that landed after its resolve gave up: publish it now.
    deps.artwork.onLateResolve = (url) => {
      if (this.disposed || this.deps.hearing.track?.artwork !== url) return;
      if (this.loadedStreamId != null) this.pushNowPlaying();
      this.emitPlayer();
    };
    repository.onChange = (change) => {
      if (change.trackChanged) {
        if (this.isQuiet) {
          // Only the lock screen is looking (it downloads its own cover): the
          // in-app cover and the lyrics wait for the return (`catchUp`).
          this.lyricsSkipped = true;
        } else {
          // Announced a stream-lag ahead of the speaker: warm its cover now.
          prefetchArtwork(
            { artwork: deps.artwork, isOnline: () => player.status.network !== "offline" },
            repository.currentTrack,
          );
          deps.onTrackAnnounced?.(repository.currentTrack);
        }
        heard.stationChanged();
        hearing.stationChanged();
      }
      if (change.programChanged) {
        // Live or not decides whether a length is estimated and shown.
        this.syncDurationEstimate();
        this.emitPlayer();
        this.emitProgress();
        // The lock screen's live badge and seek bar follow the program too.
        if (this.loadedStreamId != null) this.pushNowPlaying();
      }
      if (change.listenersChanged || change.playedChanged || change.requestedChanged) {
        this.emitStation();
      }
    };
  }

  // ── Queries ──

  get isPlayingIntent(): boolean {
    return this.pendingPlay || this.deps.player.status.playWhenReady;
  }

  /** Hidden with no audio wanted: only the lock screen looks, so the extras wait. */
  private get isQuiet(): boolean {
    return !this.appActive && !this.isPlayingIntent;
  }

  /** A track is known (the UI can render the player). */
  get isReady(): boolean {
    return !this.disposed && this.deps.repository.hasTrack;
  }

  /**
   * Lock-screen fields. The cover is always a local file (the app's cached
   * one, else the bundled default), so the media session never downloads it.
   */
  getNowPlayingMetadata(): NowPlayingMetadata {
    const { artwork } = this.deps;
    const meta = buildNowPlayingMetadata({
      track: artwork.apply(this.deps.hearing.track),
      isLive: this.deps.repository.currentProgram?.isLive ?? false,
      showProgress: this.showsProgress() && this.deps.hearing.positionKnown,
      durationMs: this.displayDurationMs(),
      defaultCover: artwork.defaultCover,
    });
    if (!meta.artwork || artwork.isRemote(meta.artwork)) meta.artwork = artwork.defaultCover;
    return meta;
  }

  /**
   * Where the listener is in the shown song right now, `null` while unknown;
   * held at the song's end once past it. Without audio: the station's live point.
   */
  heardPosition(): HeardPosition | null {
    const { hearing } = this.deps;
    const track = hearing.track;
    const position = hearing.positionKnown ? hearing.position() : null;
    if (!track || !position) return null;
    // Not started yet (a start time ahead of the clock) reads as its start.
    const elapsed = Math.max(0, positionAt(position, Date.now()));
    // Past the end (the next song not heard yet): hold at the end.
    if (track.duration > 0 && elapsed > track.duration) {
      return { raw: track.raw, elapsedMs: track.duration, advancing: false };
    }
    return { raw: track.raw, elapsedMs: elapsed, advancing: position.running };
  }

  private get isLiveProgram(): boolean {
    return this.deps.repository.currentProgram?.isLive ?? false;
  }

  /** The heard track when its length is worth estimating: a real live song the station gave none. */
  private estimableTrack(): Track | null {
    const track = this.deps.hearing.track;
    if (!track || track.duration > 0 || !this.isLiveProgram) return null;
    return isRealTrack(track) ? track : null;
  }

  /**
   * The heard track's length for display: the station's, else a live song's
   * estimate, else 0. {@link heardPosition} and the sync never read this.
   */
  private displayDurationMs(): number {
    const track = this.deps.hearing.track;
    if (!track) return 0;
    if (track.duration > 0) return track.duration;
    const estimate = this.durationEstimate;
    if (!estimate?.ms || estimate.key !== estimateKey(track)) return 0;
    return this.estimableTrack() ? estimate.ms : 0;
  }

  /** Progress is shown for a live song once any length is known; else the repository's rule. */
  private showsProgress(): boolean {
    if (this.isLiveProgram && isRealTrack(this.deps.hearing.track)) {
      return this.displayDurationMs() > 0;
    }
    return this.deps.repository.showProgress;
  }

  /** The lock screen's cover resolver: the UI reads the same local files. */
  get artwork(): Pick<ArtworkResolver, "defaultCover" | "isRemote" | "peek" | "resolve"> {
    return this.deps.artwork;
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

  // ── Lifecycle ──

  /**
   * Realtime (SSE) policy: always live, except once the app has been hidden
   * with no audio wanted past `BackgroundIdle`'s cutoff — then suspended to
   * save data and battery until the foreground or a play intent. Re-evaluated
   * on every visibility / intent change and before each SSE event (the only
   * code running when JS timers are frozen). Returns whether live is allowed.
   */
  updateLiveStreamLifecycle(): boolean {
    const { repository } = this.deps;
    const wasIdle = this.wasIdle;
    this.backgroundIdle.update(this.appActive, this.isPlayingIntent);
    this.wasIdle = this.backgroundIdle.idle;
    const allowed = this.backgroundIdle.liveAllowed();
    const resuming = allowed && repository.isSuspended;
    repository.setLiveStreamActive(allowed);
    if (resuming || (wasIdle && !this.wasIdle)) this.catchUp(resuming);
    return allowed;
  }

  /**
   * The user is back after an idle spell. From a suspension: release a stuck
   * refresh, fetch the data and re-read the played history (its changes were
   * never seen). Inside the grace: only what was deferred (history, lyrics).
   */
  private catchUp(fromSuspension: boolean): void {
    if (!this.initialized) return;
    const { repository } = this.deps;
    repository.expireStuckRefresh();
    if (fromSuspension) {
      void this.refreshData().catch((error: unknown) => {
        if (CONFIG.DEBUG) console.warn("[PlayerService] resume refresh:", error);
      });
    }
    if (fromSuspension || repository.historyStale) void this.refreshHistory("played");
    if (this.lyricsSkipped) {
      this.lyricsSkipped = false;
      this.deps.onTrackAnnounced?.(repository.currentTrack);
    }
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
      // Back after a long pause: the grace may have run out with no tick to say.
      this.deps.hearing.recheck();
      // A live song that started while hidden is estimated now.
      this.syncDurationEstimate();
      this.emitPlayer();
      this.emitStation();
      this.emitProgress();
      // The data kept still while hidden: catch up now, not on the next tick.
      if (this.initialized && Date.now() - this.lastPollAt > POLL_PAUSED_MS) {
        void this.refreshData().catch((error: unknown) => {
          if (CONFIG.DEBUG) console.warn("[PlayerService] resume refresh:", error);
        });
      }
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

  /** Read through a call so a check after an `await` sees a `dispose()` made meanwhile. */
  private isDisposed(): boolean {
    return this.disposed;
  }

  private async runSetup(): Promise<void> {
    const [streams] = await Promise.all([
      animuApi.getStreams(),
      userSettingsService.initialize(),
      this.deps.artwork.init(),
      this.deps.stats.initialize(),
    ]);
    if (this.disposed) return;
    this.streamOptions = streams;
    this.deps.sampler.setEnabled(userSettingsService.getCurrentSettings().visualizerHz > 0);
    this.updateLiveStreamLifecycle();
    await this.deps.streamPreferences.load(streams);
    if (this.isDisposed()) return;
    try {
      await this.refreshData();
    } catch (error) {
      console.warn("[PlayerService] setupPlayer: initial data fetch failed:", error);
    }
    if (this.isDisposed()) return;
    this.initialized = true;
    // Started before this service (Siri, the car, a reload): follow it.
    if (this.deps.player.status.state !== "idle") {
      this.handleStatus(this.deps.player.status);
      this.adoptNativeLoad();
    }
    this.publishCatalog();
    this.updateTicker();
    this.syncDurationEstimate();
    this.emitPlayer();
    this.emitProgress();
  }

  /**
   * The player holds a source the app did not load (voice request, car pick,
   * a reload): adopt the stream its quality names, and the app's now-playing.
   */
  private adoptNativeLoad(): void {
    const { status } = this.deps.player;
    const stream = this.streamOptions.find(
      (option) => option.id === (status.quality ?? status.selectedQuality),
    );
    if (!stream) return;
    this.loadedStreamId = stream.id;
    this.loadedRenditionIds = status.qualities
      .map((quality) => quality.id)
      .filter((id) => this.streamOptions.some((option) => option.id === id));
    this.deps.heard.useStream(stream.id, stream.bitrate);
    this.pushNowPlaying();
    this.emitPlayer();
    // Not the listener's pick: back to it, without a gap.
    const pick = this.deps.streamPreferences.current;
    if (pick.id !== stream.id && this.loadedRenditionIds.includes(pick.id)) void this.retune(pick);
  }

  private publishCatalog(): void {
    void this.deps
      .publishCatalog?.(this.streamOptions, this.deps.streamPreferences.current)
      .catch((error: unknown) => console.warn("[PlayerService] catalog:", error));
  }

  /** Releases the player and every unit. Safe at any stage; one-way. */
  async destroy(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    // Free the singleton first: a remount meanwhile must get a fresh service,
    // or the app sits on the loading screen.
    this.deps.onDestroyed?.();
    this.deps.ticker.stop();
    this.deps.stats.onPlaybackStopped();
    this.unsubscribe.forEach((off) => off());
    this.deps.sampler.dispose();
    this.deps.repository.dispose();
    this.deps.repository.clear();
    this.deps.artwork.reset();
    this.deps.hearing.reset();
    this.deps.streamPreferences.reset();
    this.durationEstimate = null;
    this.initialized = false;
    this.streamOptions = [];
    // The last store write: once a replacement exists, the stores are its own.
    playerStore.setSnapshot({
      isPlaying: false,
      playbackState: "idle",
      isInitialized: false,
      syncing: false,
    });
    stationStore.setSnapshot({});
    progressStore.setSnapshot({
      progressMs: null,
      progressAt: 0,
      progressRunning: false,
      showProgress: false,
      durationMs: 0,
    });
    try {
      await this.deps.player.release();
    } catch (error) {
      console.error("[PlayerService] release failed:", error);
    }
  }

  // ── Commands ──

  async play(): Promise<void> {
    if (this.disposed) return;
    // Read before `syncIntent` takes the display out of station mode.
    const wasStation = this.deps.hearing.mode === "station";
    this.pendingPlay = true;
    this.syncIntent();
    // Audio wanted: the realtime stream is back at once (lock-screen play too).
    this.updateLiveStreamLifecycle();
    this.emitPlayer();
    try {
      if (this.streamOptions.length) await this.deps.streamPreferences.restore(this.streamOptions);
      // Paused or torn down while the preference was read.
      if (this.isDisposed() || !this.isPlayingIntent) return;
      const stream = this.deps.streamPreferences.current;
      if (this.loadedStreamId !== stream.id) {
        await this.open(stream, true);
      } else if (wasStation) {
        // The display gave up the heard position (a long pause). Airwave
        // re-opens at the live edge only past its own drift threshold, so near
        // it a plain resume continues in place with no status and no title,
        // and the position stays "syncing" for minutes. Always re-open.
        await this.open(stream, true);
      } else {
        // Airwave resumes in place, or re-opens at the live edge.
        await this.deps.player.play();
      }
      void this.refreshData().catch((error: unknown) => console.warn("[PlayerService] refresh:", error));
    } catch (error) {
      console.error("[PlayerService] Playback error:", error);
      throw error;
    } finally {
      this.pendingPlay = false;
      // A failed play leaves no intent: the display follows the station.
      this.syncIntent();
      this.updateLiveStreamLifecycle();
      this.updateTicker();
      this.emitPlayer();
    }
  }

  async pause(): Promise<void> {
    this.pendingPlay = false;
    if (this.disposed) return;
    await this.deps.player.pause();
    this.syncIntent();
    this.updateLiveStreamLifecycle();
    this.updateTicker();
    this.emitPlayer();
  }

  async changeStream(stream: Stream): Promise<void> {
    if (this.deps.streamPreferences.current.id === stream.id) return;
    await this.deps.streamPreferences.set(stream);
    this.publishCatalog();
    // Re-tune only a loaded player; otherwise the next play() opens it.
    if (this.loadedStreamId != null) await this.retune(stream);
    this.emitPlayer();
  }

  /**
   * Switches a loaded player to `stream`: among the loaded renditions behind
   * what is heard (the status reports when it lands), else by re-opening.
   */
  private async retune(stream: Stream): Promise<void> {
    if (this.loadedRenditionIds.includes(stream.id)) {
      this.loadedStreamId = stream.id;
      try {
        await this.deps.player.selectQuality(stream.id);
        return;
      } catch (error) {
        console.warn("[PlayerService] selectQuality:", error);
      }
    }
    await this.open(stream, this.isPlayingIntent);
  }

  /** Opens `stream` (a different relay buffers differently: re-lock the position). */
  private async open(stream: Stream, autoplay: boolean): Promise<void> {
    this.loadedStreamId = stream.id;
    this.tuneIn = true;
    this.deps.heard.useStream(stream.id, stream.bitrate);
    this.deps.heard.reopened();
    this.deps.hearing.reopened();
    const source = streamSource(this.streamOptions, stream);
    this.loadedRenditionIds = source.renditions?.map((rendition) => rendition.id) ?? [];
    try {
      await this.deps.player.load(
        { ...source, metadata: this.getNowPlayingMetadata() },
        { autoplay, ...(source.renditions && { quality: stream.id }) },
      );
    } catch (error) {
      // Recoverable failures keep reconnecting natively; the status tells the UI.
      console.warn("[PlayerService] load:", error);
    } finally {
      // A load drops the app's lock-screen fields (its own rank below the ICY
      // title): set them again, also after a failure the player recovers from.
      this.pushNowPlaying();
    }
  }

  // ── Data ──

  async refreshData(options?: { forceMetadata?: boolean }): Promise<boolean> {
    this.lastPollAt = Date.now();
    return this.deps.repository.refresh(options);
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
      if (playing) this.deps.stats.onPlaybackStarted();
      else this.deps.stats.onPlaybackStopped();
    }
    // A (re)open: the next title reported is a tune-in.
    const reopening = status.state === "loading" || status.state === "reconnecting";
    if (reopening && !this.tuneIn) this.markReopened();
    this.followQuality(status.quality);
    this.deps.heard.setRunning(playing);
    this.syncIntent();
    this.deps.hearing.setPlaying(playing);
    this.deps.sampler.setPlaying(playing);
    this.updateLiveStreamLifecycle();
    this.updateTicker();
    this.emitPlayer();
    this.emitProgress();
  }

  /**
   * Tells the display whether audio is wanted and whether the player holds its
   * place: what decides between following the audio and the station.
   */
  private syncIntent(): void {
    const state = this.lastState;
    this.deps.hearing.setIntent(this.isPlayingIntent, state === "paused" || state === "playing");
  }

  /** The source re-opened: the position is re-placed from the next title, as a tune-in. */
  private markReopened(): void {
    this.tuneIn = true;
    this.deps.heard.reopened();
    this.deps.hearing.reopened();
    // The lock screen drops the position too until the tune-in places it.
    this.pushNowPlaying();
  }

  /**
   * The audio jumped with no state change: a fresh connection replaced a
   * dropped one, and its connect burst replays recent audio (up to 16 s on the
   * 64 kbps mount). Re-place the shown song as a tune-in, or the lyrics run
   * seconds off; its title is not reported again.
   */
  private handleDiscontinuity(): void {
    if (this.tuneIn) return; // Already being placed.
    const raw = this.deps.hearing.track?.raw;
    debugLog("[PlayerService] the stream's connection was replaced: re-placing");
    this.markReopened();
    this.deps.hearing.setPlaying(this.lastState === "playing");
    if (raw) this.hearTitle(raw, Date.now());
    this.emitPlayer();
    this.emitProgress();
  }

  /**
   * The rendition playing changed. A switch while playing lands on another
   * relay's fresh connection with no status and no `discontinuity`: re-place
   * the song as after one. (Not playing, the loading status re-places it.)
   */
  private followQuality(quality: string | null): void {
    if (quality === this.playingQuality) return;
    const switched = this.playingQuality != null;
    this.playingQuality = quality;
    const stream = this.streamOptions.find((option) => option.id === quality);
    if (!stream) return;
    this.deps.heard.useStream(stream.id, stream.bitrate);
    if (switched && this.lastState === "playing") this.handleDiscontinuity();
  }

  /** An ICY title became audible (Airwave reports it when heard). */
  private handleStreamMetadata(metadata: MediaMetadata): void {
    const title = metadata.raw?.StreamTitle;
    if (!title) return;
    this.hearTitle(title, metadata.timestamp);
  }

  private hearTitle(title: string, heardAt: number): void {
    const tuneIn = this.tuneIn;
    this.tuneIn = false;
    // How far the speaker trails the live edge (places a tune-in, calibrates at
    // a change); the locked clock's lag, as a reading falls through an outage.
    const progress = this.deps.player.getProgress();
    const lagMs = this.deps.hearing.lagMs((progress.liveOffset ?? progress.bufferedAhead) * 1000);
    debugLog(
      `[PlayerService] heard "${title}" tuneIn=${tuneIn} lag=${Math.round(lagMs)}ms tuneInBias=${Math.round(this.deps.heard.tuneInBiasMs)}ms`,
    );
    this.deps.heard.heard(title, heardAt, tuneIn, lagMs);
    this.deps.hearing.titleWasHeard();
  }

  /** The displayed track changed: UI, progress, lock screen and stats move together. */
  private handleDisplayedTrackChange(): void {
    if (this.deps.hearing.anchored) {
      this.deps.stats.onTrackHeard(this.deps.hearing.track, this.lastState === "playing");
    }
    this.tickStats();
    this.syncDurationEstimate();
    this.emitPlayer();
    this.emitProgress();
    this.updateNowPlaying();
  }

  /**
   * Keeps {@link durationEstimate} on the heard song: asked once per song, in
   * the foreground only (no background network); a late answer is ignored.
   */
  private syncDurationEstimate(): void {
    const track = this.estimableTrack();
    const estimate = this.deps.estimateDuration;
    if (!track || !estimate) {
      this.durationEstimate = null;
      return;
    }
    const key = estimateKey(track);
    if (this.durationEstimate?.key === key) return;
    if (!this.appActive) {
      this.durationEstimate = null;
      return;
    }
    this.durationEstimate = { key, ms: null };
    void estimate(track)
      .then(
        (ms) => ms,
        () => {
          // A failed lookup is forgotten so the next sync asks again; "not
          // found" stays answered.
          if (this.durationEstimate?.key === key) this.durationEstimate = null;
          return null;
        },
      )
      .then((ms) => {
        if (this.disposed || this.durationEstimate?.key !== key) return;
        if (ms == null || !Number.isFinite(ms) || ms <= 0) return;
        this.durationEstimate = { key, ms };
        this.emitProgress();
        if (this.loadedStreamId != null) this.pushNowPlaying();
      });
  }

  /** Lock screen: fields and progress, the cover once cached locally (a low-res one first). */
  private updateNowPlaying(): void {
    if (this.loadedStreamId == null) return;
    this.pushNowPlaying();
    const track = this.deps.hearing.track;
    const url = track?.artwork;
    if (!track || !url || !this.deps.artwork.isRemote(url) || this.deps.artwork.peek(url)) return;
    const stillCurrent = () => this.deps.hearing.track?.artwork === url;
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
        this.emitPlayer();
      });
  }

  private pushNowPlaying(): void {
    const meta = this.getNowPlayingMetadata();
    const elapsed = this.heardElapsedMs();
    void this.deps.player
      .updateNowPlaying({
        title: meta.title,
        artist: meta.artist,
        artwork: meta.artwork,
        // The "live" badge follows the program, not the endless stream.
        live: meta.isLiveStream ?? false,
        ...(meta.durationSec && elapsed != null
          ? { duration: meta.durationSec, elapsed: elapsed / 1000 }
          : {}),
      })
      .catch((error: unknown) => console.warn("[PlayerService] now playing:", error));
  }

  /** Lock-screen elapsed ms, from the UI's anchor; held at the displayed end once past it. */
  private heardElapsedMs(): number | null {
    const { hearing } = this.deps;
    const position = hearing.position();
    const duration = this.displayDurationMs();
    if (!position) return null;
    const elapsed = Math.max(0, positionAt(position, Date.now()));
    return duration > 0 ? Math.min(elapsed, duration) : elapsed;
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
    // A pause outlasting its grace flips the display to the station.
    this.deps.hearing.recheck();
    this.tickStats();
    this.emitProgress();
    this.deps.repository.expireStuckRefresh();
    const cadence = this.isPlayingIntent ? POLL_PLAYING_MS : POLL_PAUSED_MS;
    // Never poll over a pending retry: it would defeat the 2 s → 30 s backoff.
    if (
      Date.now() - this.lastPollAt >= cadence &&
      !this.deps.repository.retryPending
    ) {
      void this.refreshData().catch((error: unknown) => {
        if (CONFIG.DEBUG) console.warn("[PlayerService] poll:", error);
      });
    }
  }

  /**
   * Listen stats close [anchor, now) segments: ticked on every displayed
   * track, state change, foreground second and native progress reading.
   */
  private tickStats(): void {
    if (this.lastState === "playing") this.deps.stats.onAudibleTick(Date.now());
  }

  // ── Stores (single writer) ──

  private emitPlayer(): void {
    if (this.disposed || !this.appActive) return;
    const next: PlayerSnapshot = {
      currentTrack: this.deps.artwork.apply(this.deps.hearing.track) ?? undefined,
      currentProgram: this.deps.repository.currentProgram ?? undefined,
      currentStream: this.deps.streamPreferences.current,
      streamOptions: this.streamOptions,
      isPlaying: this.isPlayingIntent,
      playbackState: this.pendingPlay ? "connecting" : TRANSPORT[this.deps.player.status.state],
      isInitialized: this.initialized,
      // Audio wanted, no title heard since the source opened: "calculating".
      syncing: this.isPlayingIntent && !this.deps.hearing.anchored,
    };
    playerStore.setSnapshot(next);
  }

  private emitStation(): void {
    if (this.disposed || !this.appActive) return;
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
    if (this.disposed || !this.appActive) return;
    // An anchor, not a sample: the UI advances it in real time.
    const position = this.deps.hearing.position();
    progressStore.setSnapshot({
      progressMs: position?.elapsedMs ?? null,
      progressAt: position?.at ?? 0,
      progressRunning: position?.running ?? false,
      showProgress: this.showsProgress(),
      durationMs: this.displayDurationMs(),
    });
  }
}
