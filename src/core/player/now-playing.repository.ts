import type {
  ArtworkQuality,
  HistoryType,
  Listeners,
  LiveNowPlaying,
  Track,
} from "animu-api";
import type { Program } from "../domain/program";
import { isRealTrack } from "../domain/track";
import { BackoffScheduler } from "./backoff";
import type { Timer } from "./timer";

/** Buffer after expected track end before fetching (ms) */
const TRACK_END_BUFFER_MS = 500;
/** Delay when the track has already ended by the time we schedule (ms) */
const TRACK_END_REFRESH_SOON_MS = 1000;
/** Base retry delay (ms) — doubles each consecutive error */
const BASE_RETRY_DELAY_MS = 2000;
/** Max backoff delay on consecutive network errors (ms) */
const MAX_RETRY_DELAY_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Hard limit for a single refresh run (ms). Slightly above the HTTP abort
 * timeout so foreground timeouts always win. In the BACKGROUND, RN JS
 * timers freeze — the fetch's `setTimeout`-based abort never fires, a
 * stalled fetch never settles and `refreshing` would latch forever (every
 * later poll silently no-ops → the media session freezes on an old track).
 * `expireStuckRefresh()` — driven by the native heartbeat — breaks the
 * latch and invalidates the stuck run via the epoch guard.
 */
const REFRESH_STALE_MS = 30_000;
/**
 * How long after the last SSE event the live stream is considered a
 * trustworthy source for track/listeners. The daemon pushes at ~1 Hz and
 * reconnects on its own; past this gap the repository silently reverts the
 * metadata part of the poll to HTTP until the stream talks again.
 */
const LIVE_STALE_MS = 15_000;

/**
 * What the repository needs from the network — injectable for tests. */
export interface NowPlayingFetchers {
  getStreamMetadata(
    artworkQuality?: ArtworkQuality,
    defaultCover?: string,
  ): Promise<{ track: Track | null; listeners: Listeners }>;
  getCurrentProgram(): Promise<Program>;
  getTrackHistory(
    type: HistoryType,
    artworkQuality?: ArtworkQuality,
    defaultCover?: string,
  ): Promise<Track[]>;
  /**
   * Realtime now-playing source (SSE). Optional — when absent the
   * repository falls back to pure HTTP polling.
   */
  subscribeLive?(
    quality: ArtworkQuality,
    defaultCover: string,
    handlers: {
      onSongChange: (song: LiveNowPlaying) => void;
      onListeners: (listeners: Listeners) => void;
      onOpen?: () => void;
      onError?: (error: Error) => void;
    },
  ): () => void;
  /**
   * Aborts every in-flight HTTP request. Called by `expireStuckRefresh()`:
   * the native heartbeat drives the abort because the fetch's own
   * JS-timer timeout freezes in the background.
   */
  abortInFlightRequests(): void;
}

export interface NowPlayingRepositoryOptions {
  fetchers: NowPlayingFetchers;
  /** Runtime user setting — cover artwork quality. */
  getCoverQuality: () => ArtworkQuality;
  /** Runtime resolver value — bundled default cover for missing artwork. */
  getDefaultCover: () => string;
  timer: Timer;
}

/**
 * Which fields actually changed in the last merge. The orchestrator maps
 * these onto store emissions: track/program → now-playing UI, listeners/
 * histories → poll-data UI.
 */
export interface NowPlayingChange {
  trackChanged: boolean;
  programChanged: boolean;
  listenersChanged: boolean;
  playedChanged: boolean;
  requestedChanged: boolean;
}

const NO_CHANGE: NowPlayingChange = {
  trackChanged: false,
  programChanged: false,
  listenersChanged: false,
  playedChanged: false,
  requestedChanged: false,
};

/**
 * Owns all "what is on air right now" data: current track, program,
 * listeners and the two history lists. Merges fetched data with diffing,
 * schedules the predictive track-end refresh, and retries failed fetches
 * with exponential backoff. Emits nothing to React directly — it notifies
 * the orchestrator with the change flags, which owns the stores.
 */
export class NowPlayingRepository {
  /** Fired whenever merged data actually changed. Wired by the orchestrator. */
  onChange: (change: NowPlayingChange) => void = () => {};
  /**
   * Wired by the orchestrator: a LIVE track change must reach the media
   * session without waiting for the next poll round-trip.
   */
  onLiveTrackChange: () => void = () => {};

  private currentTrackValue: Track | null = null;
  private currentProgramValue: Program | null = null;
  private listenersValue: Listeners | null = null;
  private playedTracks: Track[] = [];
  private requestedTracks: Track[] = [];
  private showProgressValue = false;
  private refreshing = false;
  /** Bumped by every new run AND by the watchdog — late settlers compare. */
  private refreshEpoch = 0;
  private refreshStartedAt = 0;
  private trackEndTimerId: number | null = null;
  private disposed = false;
  private readonly retryScheduler: BackoffScheduler;
  /** Live SSE unsubscribe handle; null = HTTP-only mode. */
  private liveSubscription: (() => void) | null = null;
  /** Quality the live client was built with — rebuilt when the setting changes. */
  private liveQuality: ArtworkQuality | null = null;
  /** Date.now() of the last SSE event (song or listeners); null = no data yet. */
  private lastLiveEventAt: number | null = null;

  constructor(private readonly options: NowPlayingRepositoryOptions) {
    this.retryScheduler = new BackoffScheduler({
      baseMs: BASE_RETRY_DELAY_MS,
      maxMs: MAX_RETRY_DELAY_MS,
      timer: options.timer,
      label: "now-playing-refresh",
    });
  }

  // ── Queries ──

  get currentTrack(): Track | null {
    return this.currentTrackValue;
  }

  get currentProgram(): Program | null {
    return this.currentProgramValue;
  }

  get listeners(): Listeners | null {
    return this.listenersValue;
  }

  get lastPlayedTracks(): Track[] {
    return this.playedTracks;
  }

  get lastRequestedTracks(): Track[] {
    return this.requestedTracks;
  }

  /** Whether the audio session has a track to display. */
  get hasTrack(): boolean {
    return this.currentTrackValue != null;
  }

  /** Whether to show real progress in the media session notification. */
  get showProgress(): boolean {
    return this.showProgressValue;
  }

  setShowProgress(value: boolean): void {
    this.showProgressValue = value;
  }

  // ── Realtime stream (SSE) ──

  /**
   * Attaches the SSE now-playing stream, replacing the HTTP metadata poll
   * while it is healthy. The daemon seeds a new connection with the current
   * state, so no one-shot fetch is needed; the poll keeps running for
   * program/history and silently re-covers track/listeners whenever the
   * stream goes quiet past {@link LIVE_STALE_MS}.
   */
  startLive(): void {
    if (
      !this.options.fetchers.subscribeLive ||
      this.disposed ||
      this.liveSubscription
    ) {
      return;
    }
    this.liveQuality = this.options.getCoverQuality();
    this.liveSubscription = this.options.fetchers.subscribeLive(
      this.liveQuality,
      this.options.getDefaultCover(),
      {
        onSongChange: (song) => this.ingestSong(song),
        onListeners: (listeners) => this.ingestListeners(listeners),
        onOpen: () => {
          // Fresh connection (or reconnect) — drop the stale marker so the
          // next poll trusts the live source again.
          this.lastLiveEventAt = Date.now();
        },
        onError: (error) => {
          // The client reconnects with its own backoff; this only logs.
          // The stale marker below is what re-routes the poll to HTTP.
          console.warn("[NowPlayingRepository] live stream error:", error);
          this.lastLiveEventAt = null;
        },
      },
    );
  }

  /**
   * Rebuilds the live surface when the cover-quality setting changed (the
   * quality is baked into the SSE client's track mapper). Idempotent.
   */
  private ensureLiveCurrent(): void {
    if (this.disposed || !this.liveSubscription) return;
    const quality = this.options.getCoverQuality();
    if (quality === this.liveQuality) return;
    this.stopLive();
    this.startLive();
  }

  /**
   * Battery-policy toggle for the realtime surface (see the settings
   * screen's "live station updates" row). Safe on any lifecycle stage and
   * idempotent in both directions.
   */
  setLiveStreamActive(active: boolean): void {
    if (active) {
      this.startLive();
      return;
    }
    this.stopLive();
  }

  private stopLive(): void {
    const unsubscribe = this.liveSubscription;
    this.liveSubscription = null;
    this.lastLiveEventAt = null;
    unsubscribe?.();
  }

  /**
   * Realtime ingestion of a `song_change` push. Semantically the merge half
   * of `refresh()` — same diffing, same change events — just driven by the
   * stream instead of the poll. Runs synchronously (no epoch guard: the
   * source is a push, not a fetch).
   */
  private ingestSong(song: LiveNowPlaying): void {
    if (this.disposed) return;
    this.lastLiveEventAt = Date.now();

    const track = song.track;
    if (!track || !isRealTrack(track)) {
      // Offline placeholder (or jingle) — keep the current state; the UI
      // shows the old track until the station returns with real data.
      return;
    }

    const trackChanged =
      this.currentTrackValue?.raw !== track.raw ||
      this.currentTrackValue?.artwork !== track.artwork;
    if (trackChanged) {
      this.currentTrackValue = track;
      void this.refreshHistory("played");
    }

    const listenersChanged = this.listenersValue?.value !== song.listeners.value;
    if (listenersChanged) this.listenersValue = song.listeners;

    if (trackChanged || listenersChanged) {
      this.onChange({
        trackChanged,
        programChanged: false,
        listenersChanged,
        playedChanged: false,
        requestedChanged: false,
      });
    }
    if (trackChanged) this.onLiveTrackChange();
    this.scheduleTrackEndRefresh();
  }

  /** Realtime ingestion of a deduped `listeners` push. */
  private ingestListeners(listeners: Listeners): void {
    if (this.disposed) return;
    this.lastLiveEventAt = Date.now();
    if (this.listenersValue?.value === listeners.value) return;
    this.listenersValue = listeners;
    this.onChange({
      ...{
        trackChanged: false,
        programChanged: false,
        playedChanged: false,
        requestedChanged: false,
      },
      listenersChanged: true,
    });
  }

  /** ── HTTP poll, invalidated by live data past the staleness window ── */
  async refresh(): Promise<boolean> {
    if (this.disposed) return false;
    if (this.refreshing) return false;
    this.refreshing = true;
    const epoch = ++this.refreshEpoch;
    this.refreshStartedAt = Date.now();

    // Live healthy → skip the HTTP metadata leg; ingest already owns
    // track/listeners and re-writes them on the next push. A live track is
    // required for the skip: while the stream only pushed placeholders
    // (offline station), the HTTP leg must still have its chance to fill
    // state exactly like it did before SSE existed.
    this.ensureLiveCurrent();
    const liveFresh =
      this.liveSubscription != null &&
      this.currentTrackValue != null &&
      this.lastLiveEventAt != null &&
      Date.now() - this.lastLiveEventAt <= LIVE_STALE_MS;

    try {
      const [metadata, program, newRequestedTracks] = await Promise.all([
        liveFresh
          ? Promise.resolve({
              track: this.currentTrackValue,
              listeners: this.listenersValue,
            })
          : this.options.fetchers.getStreamMetadata(
              this.options.getCoverQuality(),
              this.options.getDefaultCover(),
            ),
        this.options.fetchers.getCurrentProgram(),
        this.options.fetchers.getTrackHistory(
          "requests",
          this.options.getCoverQuality(),
          this.options.getDefaultCover(),
        ),
      ]);

      const { track, listeners } = metadata;

      // Invalidated while in flight (watchdog expiry or dispose): the
      // stuck run's late settler must not write state or re-arm timers —
      // a newer run already owns the repository.
      if (epoch !== this.refreshEpoch || this.disposed) return false;

      // Same protection against the LIVE source: this HTTP run started on
      // a stale stream, but a song_change push may have landed while it
      // was in flight — pushing authoritative state. The stale HTTP
      // payload must not walk the live data backwards.
      const liveOwns =
        this.liveSubscription != null &&
        this.currentTrackValue != null &&
        this.lastLiveEventAt != null &&
        Date.now() - this.lastLiveEventAt <= LIVE_STALE_MS;

      // HTTP fetched invalid track data (and live is not authoritative to
      // rescue us) → skip the update; keep the tests' intent unchanged.
      if (!liveOwns && !track) {
        console.warn(
          "[NowPlayingRepository] API returned invalid track data, skipping update",
        );
        return false;
      }

      let trackChanged = false;

      if (
        track &&
        !liveOwns &&
        (this.currentTrackValue?.raw !== track.raw ||
          this.currentTrackValue?.artwork !== track.artwork)
      ) {
        this.currentTrackValue = track;
        trackChanged = true;

        void this.refreshHistory("played");
      }

      const programChanged =
        this.currentProgramValue?.name !== program.name ||
        this.currentProgramValue?.dj !== program.dj ||
        this.currentProgramValue?.isLive !== program.isLive;
      if (programChanged) this.currentProgramValue = program;

      // Enable progress for real, non-live tracks (radio keeps playing
      // server-side so we always show progress). Recompute on EITHER change:
      // a live block starting/ending while the same track stays on air must
      // still flip the seek bar off/on.
      if (trackChanged || programChanged) {
        this.showProgressValue =
          isRealTrack(this.currentTrackValue) && !program.isLive;
      }

      // Same live-authority rule for the listener count: on a skip leg it
      // is the snapshot we just installed out of (never differs); after a
      // mid-flight push, the HTTP count is stale and must not regress it.
      const listenersChanged =
        !liveOwns &&
        listeners != null &&
        this.listenersValue?.value !== listeners.value;
      if (listenersChanged) this.listenersValue = listeners;

      const requestedChanged =
        newRequestedTracks.length > 0 &&
        newRequestedTracks[0].raw !== (this.requestedTracks[0]?.raw || "");
      if (requestedChanged) this.requestedTracks = newRequestedTracks;

      // Note: the fire-and-forget `refreshHistory("played")` triggered by a
      // track change reports its own playedChanged flag when it completes.
      const changed =
        trackChanged || programChanged || listenersChanged || requestedChanged;

      if (changed) {
        this.onChange({
          ...NO_CHANGE,
          trackChanged,
          programChanged,
          listenersChanged,
          requestedChanged,
        });
      }

      // ── Success: reset error backoff & schedule track-end refresh ──
      this.retryScheduler.reset();
      this.scheduleTrackEndRefresh();

      // Only identity changes count as "changed": listener/request ticks
      // reach the badge UI through onChange but never re-push metadata.
      return trackChanged || programChanged;
    } catch (error) {
      // Invalidated run: its failure belongs to the past — no logging
      // noise, no retry re-arming over a newer run's head.
      if (epoch !== this.refreshEpoch || this.disposed) return false;

      console.error("[NowPlayingRepository] Error refreshing data:", error);

      // ── Network / API error: exponential backoff retry ──
      this.retryScheduler.schedule(() => {
        void this.refresh().catch(console.error);
      });

      return false;
    } finally {
      // Only the current run may release the latch — an expired run's
      // late settler must not unlock a newer run's single-flight guard.
      if (epoch === this.refreshEpoch) this.refreshing = false;
    }
  }

  /**
   * Heartbeat watchdog: expires a refresh run that has outlived
   * `REFRESH_STALE_MS`. In the background, JS timers freeze — a stalled
   * fetch's `setTimeout`-based abort never fires, the run never settles
   * and `refreshing` would latch forever, freezing all now-playing data
   * (media session + UI stuck on an old track). Called from the native
   * 1 Hz heartbeat, which keeps ticking where JS timers don't.
   */
  expireStuckRefresh(): void {
    if (!this.refreshing) return;
    if (Date.now() - this.refreshStartedAt <= REFRESH_STALE_MS) return;
    console.warn(
      `[NowPlayingRepository] expired stuck refresh after ${
        Date.now() - this.refreshStartedAt
      }ms — releasing latch`,
    );
    // Invalidate the stuck run: its late settler is epoch-guarded and
    // will discard its payload without writing state.
    this.refreshEpoch++;
    this.refreshing = false;
    // Cut the hung sockets loose — the fetch's own abort timeout is a JS
    // timer and never fires in the background. The rejected run is
    // discarded by the epoch guard; the next poll opens fresh connections.
    this.options.fetchers.abortInFlightRequests();
  }

  /**
   * Incrementally merges a history type into its list.
   *
   * The station feeds are newest-first. Fresh (unknown) tracks are
   * collected in payload order and prepended as a block, so the merged
   * list stays newest-first for the UI. The walk stops at a known track
   * older than a day — everything after is guaranteed older/known. Tracks
   * already known stop nothing but add nothing (dedup by `raw`, first =
   * newest occurrence wins for repeats within one payload).
   */
  async refreshHistory(type: HistoryType): Promise<void> {
    if (this.disposed) return;
    try {
      const tracks = await this.options.fetchers.getTrackHistory(
        type,
        this.options.getCoverQuality(),
        this.options.getDefaultCover(),
      );
      if (!tracks || tracks.length === 0) return;

      const target =
        type === "requests" ? this.requestedTracks : this.playedTracks;

      const fresh: Track[] = [];
      const seenPayloadRaws = new Set<string>();
      for (const track of tracks) {
        if (seenPayloadRaws.has(track.raw)) continue;
        seenPayloadRaws.add(track.raw);

        const isKnown = target.some((t) => t.raw === track.raw);
        if (isKnown) {
          if (Date.now() - track.startTime.getTime() > DAY_MS) break;
          continue;
        }
        fresh.push(track);
      }
      if (fresh.length === 0) return;

      if (type === "requests") {
        this.requestedTracks = [...fresh, ...this.requestedTracks];
      } else {
        this.playedTracks = [...fresh, ...this.playedTracks];
      }

      this.onChange({
        ...NO_CHANGE,
        playedChanged: type === "played",
        requestedChanged: type === "requests",
      });
    } catch (error) {
      console.error(
        `[NowPlayingRepository] Error refreshing ${type} history:`,
        error,
      );
    }
  }

  /**
   * Predictive refresh: schedules a fetch right after the current real,
   * non-live track is expected to end (`startTime + duration + buffer`),
   * keeping the UI ahead of the station instead of polling blindly.
   */
  scheduleTrackEndRefresh(): void {
    this.cancelTrackEndTimer();

    const track = this.currentTrackValue;
    if (!track || track.duration <= 0) return;
    // Don't schedule for non-real tracks (jingles, transitions) or live
    if (!isRealTrack(track)) return;
    if (this.currentProgramValue?.isLive) return;

    const msUntilEnd =
      track.startTime.getTime() + track.duration - Date.now();
    const delay =
      msUntilEnd > 0
        ? msUntilEnd + TRACK_END_BUFFER_MS
        : TRACK_END_REFRESH_SOON_MS;

    this.trackEndTimerId = this.options.timer.set(() => {
      this.trackEndTimerId = null;
      void this.refresh().catch(console.error);
    }, delay);
  }

  /**
   * Permanently stops the repository (destroy path): cancels every
   * pending timer and makes all future fetches no-ops. This is what
   * kills zombie chains — an in-flight `refresh()` whose catch fires
   * AFTER teardown can no longer re-arm the retry scheduler or emit.
   */
  dispose(): void {
    this.disposed = true;
    this.stopLive();
    this.cancelTrackEndTimer();
    this.retryScheduler.reset();
  }

  /** Clears all now-playing data (destroy path). */
  clear(): void {
    this.currentTrackValue = null;
    this.currentProgramValue = null;
    this.listenersValue = null;
    this.playedTracks = [];
    this.requestedTracks = [];
    this.showProgressValue = false;
  }

  private cancelTrackEndTimer(): void {
    this.options.timer.clear(this.trackEndTimerId);
    this.trackEndTimerId = null;
  }
}
