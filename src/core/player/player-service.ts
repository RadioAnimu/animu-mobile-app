import type { HistoryType } from "animu-api";
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
  /** On-device listen stats (optional for test fixtures). */
  stats?: typeof listenStatsService;
  /** Foreground 1 Hz ticker: progress store, data polls, listen-stats segments. */
  ticker: Ticker;
  /** Called as teardown starts (frees the app-wide singleton for a replacement). */
  onDestroyed?: () => void;
  /**
   * The station announced a track: it is heard a stream lag later (seconds).
   * Lets other features warm up for it (lyrics).
   */
  onTrackAnnounced?: (track: Track | null) => void;
  /**
   * A live program's song with no length from the station: its length as the
   * lyrics database knows it (ms), `null` when there is none. May reject.
   * Display only (see {@link PlayerService}'s duration estimate).
   */
  estimateDuration?: (track: Track) => Promise<number | null>;
}

/** The heard song's position, read on demand (the lyrics clock samples it). */
export interface HeardPosition {
  /** `raw` of the heard track, to match it to what the UI shows. */
  raw: string;
  /** Elapsed ms into the track at the moment of the call. */
  elapsedMs: number;
  /**
   * The position advances with the wall clock: audio is flowing, or the
   * display follows the station's live point (nothing is audible then, but
   * the music on air moves on). Stops at the track's end.
   */
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
 * The app's player: Rádio Animu's streams on react-native-anything-player, with the
 * station's own now-playing data on top.
 *
 * Airwave owns playback natively — the state machine, reconnects, stall and
 * network recovery, live-edge resumes, audio focus, interruptions, the lock
 * screen and its remote commands, background keepalive. This class does what
 * only the app knows:
 *
 * - which stream to play (user preference, bitrate picker);
 * - what is on air (`NowPlayingRepository`: SSE + HTTP, history, listeners);
 * - what is *heard* and how far into it (`NowHearing`: the ICY titles as
 *   they play, the audible clock behind them) — shown in the UI and on the
 *   lock screen, where Airwave advances the song's progress natively;
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
  /** Hidden with no audio wanted — the clock behind the realtime-connection deadline. */
  private readonly backgroundIdle = new BackgroundIdle();
  /** The previous evaluation saw the app idle: leaving it is a "return" (catch up). */
  private wasIdle = false;
  /** A track change skipped the lyrics prefetch while idle; the return does it. */
  private lyricsSkipped = false;
  /**
   * The heard live song's length estimated from its lyrics — only for a real
   * song on a live program that sends no duration (the daemon's "notime":
   * not in the station library). `ms` is `null` while the lookup is pending
   * or found nothing; a different song (key) makes it void. It feeds the
   * DISPLAY only (bar, countdown, lock screen): the station's own `duration`
   * keeps driving the sync — a TV-size row (1:30) against a full cut on air
   * (4:00) must not end the lyrics and the position at 1:30.
   */
  private durationEstimate: { key: string; ms: number | null } | null = null;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(private readonly deps: PlayerServiceDependencies) {
    const { player, repository, heard, hearing } = deps;
    this.unsubscribe.push(
      player.on("status", (status) => this.handleStatus(status)),
      player.on("metadata", (metadata) => this.handleStreamMetadata(metadata)),
      player.on("discontinuity", () => this.handleDiscontinuity()),
      // Native-timer readings while playing: they keep the audible clock
      // measured, and run JS at song boundaries even where JS timers are
      // frozen (Android in the background) — the stuck-refresh watchdog too.
      player.on("progress", (reading) => {
        hearing.progress(reading);
        repository.expireStuckRefresh();
        repository.tickLive();
      }),
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
    hearing.onChange = () => this.handleDisplayedTrackChange();
    heard.onUnknownTitle = (title) => {
      // Event-driven, no timer: a stuck refresh is expired by time, then one
      // HTTP fetch names the track (the SSE may be down in the background, or
      // have missed the item while it looks healthy).
      repository.expireStuckRefresh();
      void this.refreshData({ forceMetadata: true })
        .catch((error) => console.warn("[PlayerService] refresh for heard title:", error))
        .finally(() => heard.unresolved(title));
    };
    // The deadline is enforced where JS runs in the background: the SSE events.
    repository.shouldStayLive = () => this.updateLiveStreamLifecycle();
    repository.isQuiet = () => this.isQuiet;
    // A cover that landed after its resolve gave up: the lock screen (local
    // files only) is still on the default — publish it, and the UI with it.
    deps.artwork.onLateResolve = (url) => {
      if (this.disposed || this.deps.hearing.track?.artwork !== url) return;
      if (this.loadedStreamId != null) this.pushNowPlaying();
      this.emitPlayer();
    };
    repository.onChange = (change) => {
      if (change.trackChanged) {
        if (this.isQuiet) {
          // Hidden and nothing playing: only the lock screen is looking, and
          // its path (a station-mode display change → `updateNowPlaying`)
          // downloads the cover itself. The in-app cover and the lyrics wait
          // for the return (`catchUp`).
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
        // The lock screen too: its live badge and seek bar follow the program,
        // and the same song can stay on air across the switch.
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

  /**
   * Hidden with no audio wanted, read straight from the truth (no clock
   * involved): the state in which nothing but the lock screen looks at the
   * station, so its extras (history, lyrics, in-app cover) are deferred.
   */
  private get isQuiet(): boolean {
    return !this.appActive && !this.isPlayingIntent;
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
   * Where the listener is in the shown song, right now — `null` while that is
   * not known (no title heard / the clock not settled since the source
   * opened, or no usable start time); held at the song's end once past it.
   * Without audio it is the station's live point. Cheap: arithmetic on the
   * current anchor.
   */
  heardPosition(): HeardPosition | null {
    const { hearing } = this.deps;
    const track = hearing.track;
    const position = hearing.positionKnown ? hearing.position() : null;
    if (!track || !position) return null;
    // Not started yet (a start time ahead of the clock) reads as its start.
    const elapsed = Math.max(0, positionAt(position, Date.now()));
    // Past the song's end (the next one is not heard / announced yet): the
    // song is over, not lost — hold at its end.
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

  /**
   * Whether progress (bar, countdown, lock-screen seek bar) is shown. A live
   * program's real song shows it whenever a length is known — the station's
   * or the estimate; elsewhere the repository's rule (a real track on a
   * non-live program) stands.
   */
  private showsProgress(): boolean {
    if (this.isLiveProgram && isRealTrack(this.deps.hearing.track)) {
      return this.displayDurationMs() > 0;
    }
    return this.deps.repository.showProgress;
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
   * Realtime (SSE) policy: a radio client is always kept up to date — except
   * once the user has not cared for `BACKGROUND_IDLE_CUTOFF_MS` (10 min): the app
   * hidden AND no audio wanted (see `BackgroundIdle`). Then the connection and
   * the automatic station work are suspended to save data and battery, and
   * come back with the foreground or a play intent (the lock screen's
   * included), catching up.
   *
   * Re-evaluated at every visibility and intent change, and by the repository
   * before each SSE event (the only code running when JS timers are frozen).
   * Returns whether the live work is allowed.
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
   * The user is back (foreground, or audio wanted again) after an idle spell.
   * Resuming from a suspension: the stream is re-attached (the daemon seeds
   * the current state), a stuck refresh is released first so the fetch is not
   * swallowed by its latch, the data is fetched and the played history is
   * re-read — it only refreshes on a track change otherwise, and the changes
   * of the suspended span were never seen. A return inside the grace only
   * makes up what was deferred: a skipped history fetch and the lyrics.
   */
  private catchUp(fromSuspension: boolean): void {
    if (!this.initialized) return;
    const { repository } = this.deps;
    repository.expireStuckRefresh();
    if (fromSuspension) {
      void this.refreshData().catch((error) => {
        if (CONFIG.DEBUG) console.warn("[PlayerService] resume refresh:", error);
      });
    }
    // Inside the grace the stream never dropped, so the data is current: only
    // the history fetch a track change skipped is owed.
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
      // The data kept still while hidden (a 30 s poll at best): catch up now,
      // not on the next tick.
      if (this.initialized && Date.now() - this.lastPollAt > POLL_PAUSED_MS) {
        void this.refreshData().catch((error) => {
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
    this.syncDurationEstimate();
    this.emitPlayer();
    this.emitProgress();
  }

  /** Releases the player and every unit. Safe at any stage; one-way. */
  async destroy(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    // Free the singleton before the native release: a remount meanwhile (back
    // exit, then relaunch) must get a fresh service, not this disposed one —
    // it would never initialize, leaving the app on the loading screen.
    this.deps.onDestroyed?.();
    this.deps.ticker.stop();
    this.deps.stats?.onPlaybackStopped();
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
    // Reset the stores now, the last write: once a replacement exists they
    // are its own (a late write here would hide its UI behind the loader).
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
    // Read before the intent is set: `syncIntent` takes the display out of
    // station mode, and the resume below depends on where it was.
    const wasStation = this.deps.hearing.mode === "station";
    this.pendingPlay = true;
    this.syncIntent();
    // Audio wanted: the realtime stream is back at once, even if the idle
    // deadline had passed while the app stayed hidden (lock-screen play).
    this.updateLiveStreamLifecycle();
    this.emitPlayer();
    try {
      if (this.streamOptions.length) await this.deps.streamPreferences.restore(this.streamOptions);
      const stream = this.deps.streamPreferences.current;
      if (this.loadedStreamId !== stream.id) {
        await this.open(stream, true);
      } else if (wasStation) {
        // The display had already given up the heard position — a pause past
        // the station grace (`STATION_AFTER_PAUSE_MS`), or a torn-down player.
        // Airwave re-opens at the live edge only past *its* drift threshold
        // (`liveMaxDriftMs`), and it counts the drift of earlier pauses too,
        // while the app flips on its own JS clock: near the boundary a plain
        // resume continues in place, reporting no loading status and no fresh
        // ICY title, so the position would stay unknown ("syncing") until the
        // next song's title, minutes away. Re-open unconditionally instead —
        // the resume is always a tune-in at the live edge, which is what
        // Airwave does past the threshold anyway.
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
      // A play that failed leaves no intent: the display follows the station,
      // and the idle clock may start.
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
    // Re-tune only a loaded player; otherwise the next play() opens it.
    if (this.loadedStreamId != null) await this.open(stream, this.isPlayingIntent);
    this.emitPlayer();
  }

  /** Opens `stream` (a different relay buffers differently: re-lock the position). */
  private async open(stream: Stream, autoplay: boolean): Promise<void> {
    this.loadedStreamId = stream.id;
    this.tuneIn = true;
    this.deps.heard.useStream(stream.id, stream.bitrate);
    this.deps.heard.reopened();
    this.deps.hearing.reopened();
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
      if (playing) this.deps.stats?.onPlaybackStarted();
      else this.deps.stats?.onPlaybackStopped();
    }
    // A (re)open — reconnect, live-edge resume, stream change: the next title
    // reported is a tune-in.
    const reopening = status.state === "loading" || status.state === "reconnecting";
    if (reopening && !this.tuneIn) this.markReopened();
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
   * Tells the display whether audio is wanted, and whether the player holds
   * its place (paused, or still pausing) — what decides between following
   * the audio and following the station. Every command and status event that
   * can change either calls it.
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
    // The lock screen drops the song's position too until the tune-in places
    // it (natively it would keep advancing the one from before the re-open).
    this.pushNowPlaying();
  }

  /**
   * The audio jumped with no state change: the player moved onto a fresh
   * connection of the live stream (a dropped one replaced without stopping),
   * whose connect burst replays recent audio — back by up to the burst
   * (16 s on the 64 kbps mount) less the outage. A position extrapolated
   * from the last title would run on as if nothing happened: lyrics seconds
   * off for the rest of the song. The song is placed again like after a
   * re-open; its title is not reported again (same metadata), so the track
   * already shown is re-heard as a tune-in.
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

  /** An ICY title became audible (Airwave reports it when heard). */
  private handleStreamMetadata(metadata: MediaMetadata): void {
    const title = metadata.raw?.StreamTitle;
    if (!title) return;
    this.hearTitle(title, metadata.timestamp);
  }

  private hearTitle(title: string, heardAt: number): void {
    const tuneIn = this.tuneIn;
    this.tuneIn = false;
    // How far the speaker trails the live edge right now (places a tune-in;
    // at a change it calibrates the next one). Once the clock has locked, its
    // lag: a reading falls while the buffer drains through an outage.
    const progress = this.deps.player.getProgress();
    const lagMs = this.deps.hearing.lagMs((progress.liveOffset ?? progress.bufferedAhead) * 1000);
    debugLog(
      `[PlayerService] heard "${title}" tuneIn=${tuneIn} lag=${Math.round(lagMs)}ms tuneInBias=${Math.round(this.deps.heard.tuneInBiasMs)}ms`,
    );
    this.deps.heard.heard(title, heardAt, tuneIn, lagMs);
    this.deps.hearing.titleWasHeard();
  }

  /**
   * The displayed track changed (heard, or the station's when nothing is
   * heard or wanted): UI, progress, lock screen and stats move together.
   */
  private handleDisplayedTrackChange(): void {
    if (this.deps.hearing.anchored) {
      this.deps.stats?.onTrackHeard(this.deps.hearing.track, this.lastState === "playing");
    }
    this.tickStats();
    this.syncDurationEstimate();
    this.emitPlayer();
    this.emitProgress();
    this.updateNowPlaying();
  }

  /**
   * Keeps {@link durationEstimate} on the heard song: dropped when it changes,
   * asked once per song while the app is in the foreground (hidden: a song
   * that starts meanwhile is asked for on the return — no new background
   * network). The answer re-publishes the progress and the lock screen; one
   * for a song no longer heard is ignored.
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
          // A failed lookup (LRCLIB 503, offline) is forgotten, so the next
          // sync — the return to the foreground — asks again; a lookup that
          // found nothing stays answered.
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

  /**
   * Lock screen: title/artist/cover, and the song's progress when known —
   * Airwave advances it natively while audio plays. The cover is published
   * as soon as it is cached locally (a low-res sibling first).
   */
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
        // Hand the UI the local file too (no second download of the cover).
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
        // The "live" badge follows the program, not the endless stream:
        // jingles and the tune-in sync get plain metadata, no badge.
        live: meta.isLiveStream ?? false,
        ...(meta.durationSec && elapsed != null
          ? { duration: meta.durationSec, elapsed: elapsed / 1000 }
          : {}),
      })
      .catch((error) => console.warn("[PlayerService] now playing:", error));
  }

  /**
   * Elapsed ms for the lock screen, from the same anchor as the UI: held at
   * the song's end once past it (the next title is not heard yet), so the
   * seek bar stays full instead of disappearing. The end is the displayed
   * length, estimate included.
   */
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
    // A failed refresh is already waiting on its backoff timer, which runs the
    // refresh itself: polling over it would defeat the 2 s → 30 s backoff
    // during an outage. Explicit refreshes (play, foreground, pull) bypass this.
    if (
      Date.now() - this.lastPollAt >= cadence &&
      !this.deps.repository.retryPending
    ) {
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
    if (this.disposed || !this.appActive) return;
    const next: PlayerSnapshot = {
      currentTrack: this.deps.artwork.apply(this.deps.hearing.track) ?? undefined,
      currentProgram: this.deps.repository.currentProgram ?? undefined,
      currentStream: this.deps.streamPreferences.current,
      streamOptions: this.streamOptions,
      isPlaying: this.isPlayingIntent,
      playbackState: this.pendingPlay ? "connecting" : TRANSPORT[this.deps.player.status.state],
      isInitialized: this.initialized,
      // Audio wanted but no title heard since the source opened: the position
      // is not known yet ("calculating" in the header / countdown).
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
    // An anchor, not a sample: the snapshot only changes when the position
    // is re-placed, and the UI advances it in real time between.
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
