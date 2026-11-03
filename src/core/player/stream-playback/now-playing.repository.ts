import {
  AnimuApiError,
  type ArtworkQuality,
  type HistoryType,
  type Listeners,
  type LiveNowPlaying,
  type Track,
} from "animu-api";
import type { Program } from "@/core/domain/program";
import { isRealTrack } from "@/core/domain/track";
import { BackoffScheduler } from "@/core/player/stream-playback/backoff";
import type { Timer } from "@/core/player/timer";

/** Buffer after expected track end before fetching (ms) */
const TRACK_END_BUFFER_MS = 500;
/** Delay when the track has already ended by the time we schedule (ms) */
const TRACK_END_REFRESH_SOON_MS = 1000;
/** Cap for the overdue-track backoff (ms) — see {@link NowPlayingRepository.scheduleTrackEndRefresh} */
const TRACK_END_REFRESH_MAX_MS = 30_000;
/** Base retry delay (ms) — doubles each consecutive error */
const BASE_RETRY_DELAY_MS = 2000;
/** Max backoff delay on consecutive network errors (ms) */
const MAX_RETRY_DELAY_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Cap on each in-memory history feed (a radio left on all day keeps growing them). */
const MAX_HISTORY_TRACKS = 300;
/**
 * On-air items kept before the current one, filler included: a jingle shorter
 * than the stream lag (the 4–5 s request jingle) is already replaced when its
 * ICY title is heard, and the played history drops filler.
 */
const MAX_RECENT_ON_AIR = 10;
/**
 * Hard limit for one refresh run (ms), slightly above the HTTP abort timeout so
 * that wins in the foreground. In the background the fetch's JS-timer abort
 * never fires; {@link NowPlayingRepository.expireStuckRefresh} breaks the latch.
 */
const REFRESH_STALE_MS = 30_000;
/**
 * How long after the last SSE event the stream still owns track/listeners (the
 * daemon pushes at ~1 Hz); past it the poll's metadata leg goes back to HTTP.
 */
const LIVE_STALE_MS = 15_000;

/** The legs of one run that really failed: a metadata leg the live stream owns does not count. */
const collectRefreshFailures = (
  metadata: PromiseSettledResult<{
    track: Track | null;
    listeners: Listeners | null;
  }>,
  program: PromiseSettledResult<Program>,
  requested: PromiseSettledResult<Track[]>,
  liveOwns: boolean,
): unknown[] => {
  const failures: unknown[] = [];
  if (metadata.status === "rejected" && !liveOwns) {
    failures.push(metadata.reason);
  }
  if (program.status === "rejected") failures.push(program.reason);
  if (requested.status === "rejected") failures.push(requested.reason);
  return failures;
};

/** What the repository needs from the network. */
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
  /** Realtime now-playing source (SSE); without it, HTTP polling only. */
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
  /** Fires the live client's overdue reconnect / idle timeout (JS timers freeze on Android). */
  tickLive?(): void;
  /** Aborts every in-flight HTTP request (see `expireStuckRefresh`). */
  abortInFlightRequests(): void;
}

export interface NowPlayingRepositoryOptions {
  fetchers: NowPlayingFetchers;
  /** The cover quality setting. */
  getCoverQuality: () => ArtworkQuality;
  /** The bundled default cover for missing artwork. */
  getDefaultCover: () => string;
  timer: Timer;
  /**
   * The station's "now" (epoch ms) for the track-end refresh: the server's
   * clock, not the audible one — it is about the station's data, and there may
   * be no audio. Defaults to `Date.now`.
   */
  getNow?: () => number;
}

/** Which fields changed in the last merge (the orchestrator maps them to stores). */
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

/** Payload order preserved; repeats of a `raw` keep only their first (newest) row. */
function firstOccurrences(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.raw)) return false;
    seen.add(track.raw);
    return true;
  });
}

/**
 * Owns "what is on air": track, program, listeners and the two histories.
 * Merges fetched data with diffing, schedules the track-end refresh, retries
 * with backoff, and reports change flags to the orchestrator (no React).
 */
export class NowPlayingRepository {
  /** Fired whenever merged data actually changed. */
  onChange: (change: NowPlayingChange) => void = () => {};
  /**
   * May the realtime stream keep running? Asked before every SSE event — the
   * only code running once JS timers freeze, so where a deadline is enforced.
   * `false` drops the event and suspends (see {@link setLiveStreamActive}).
   */
  shouldStayLive: () => boolean = () => true;
  /**
   * Nothing visible needs the extras (hidden, no audio wanted): a track change
   * skips the played-history fetch, and {@link historyStale} remembers it.
   */
  isQuiet: () => boolean = () => false;

  private currentTrackValue: Track | null = null;
  private currentProgramValue: Program | null = null;
  private listenersValue: Listeners | null = null;
  private playedTracks: Track[] = [];
  private requestedTracks: Track[] = [];
  /** Items that were on air before the current one, newest first (filler too). */
  private recentOnAir: Track[] = [];
  /** The run in flight, for a forced refresh to queue behind. */
  private inFlight: Promise<boolean> | null = null;
  private showProgressValue = false;
  private refreshing = false;
  /** Bumped by every new run and by the watchdog: late settlers compare. */
  private refreshEpoch = 0;
  private refreshStartedAt = 0;
  private trackEndTimerId: number | null = null;
  /** Overdue refreshes run for the current track (backs off a track reported past its end). */
  private overdueRefreshes = 0;
  private disposed = false;
  /**
   * Automatic work is off ({@link setLiveStreamActive}): no SSE, no timers,
   * `refresh()` a no-op, and a run in flight is dropped when it settles.
   */
  private suspended = false;
  /** A track change skipped the played-history fetch (see {@link isQuiet}). */
  private playedStale = false;
  private readonly retryScheduler: BackoffScheduler;
  /** Live SSE unsubscribe handle; null = HTTP-only mode. */
  private liveSubscription: (() => void) | null = null;
  /** Quality the live client was built with — rebuilt when the setting changes. */
  private liveQuality: ArtworkQuality | null = null;
  /** Date.now() of the last SSE event (song or listeners); null = no data yet. */
  private lastLiveEventAt: number | null = null;
  /**
   * The stream's last `song_change` is the current item. Cleared by a live
   * error (a payload that failed validation is dropped there) until a song
   * lands again; `listeners` pushes can't vouch for the track.
   */
  private liveTrackCurrent = false;
  /** Consecutive failed runs: logged once per streak, not per backoff retry. */
  private refreshFailureStreak = 0;

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

  /** The automatic station work is switched off (see {@link setLiveStreamActive}). */
  get isSuspended(): boolean {
    return this.suspended;
  }

  /**
   * The played history missed at least one track change while quiet
   * ({@link isQuiet}); `refreshHistory("played")` clears it.
   */
  get historyStale(): boolean {
    return this.playedStale;
  }

  /** The items on air before the current one, newest first, filler included. */
  get recentOnAirTracks(): Track[] {
    return this.recentOnAir;
  }

  /** Whether the audio session has a track to display. */
  get hasTrack(): boolean {
    return this.currentTrackValue != null;
  }

  /** Whether to show real progress in the media session notification. */
  get showProgress(): boolean {
    return this.showProgressValue;
  }

  // ── Merge helpers (shared by the SSE push and the HTTP poll) ──

  /** True when a track is a different on-air item (by identity, not fields). */
  private trackIdentityChanged(track: Track): boolean {
    return (
      this.currentTrackValue?.raw !== track.raw ||
      this.currentTrackValue.artwork !== track.artwork
    );
  }

  /** A failed refresh is waiting on its exponential backoff timer. */
  get retryPending(): boolean {
    return this.retryScheduler.isPending;
  }

  /** True when the polled program differs from the one installed. */
  private programIdentityChanged(program: Program): boolean {
    return (
      this.currentProgramValue?.name !== program.name ||
      this.currentProgramValue.dj !== program.dj ||
      this.currentProgramValue.isLive !== program.isLive ||
      this.currentProgramValue.acceptingRequests !== program.acceptingRequests
    );
  }

  /**
   * Installs a new current track. Real songs also feed the played history;
   * filler (jingles/idents/transitions) never does.
   */
  private applyTrack(track: Track): void {
    const previous = this.currentTrackValue;
    if (previous) {
      this.recentOnAir = [
        previous,
        ...this.recentOnAir.filter((t) => t.raw !== previous.raw && t.raw !== track.raw),
      ].slice(0, MAX_RECENT_ON_AIR);
    }
    this.currentTrackValue = track;
    this.overdueRefreshes = 0;
    if (!isRealTrack(track)) return;
    if (this.isQuiet()) {
      this.playedStale = true;
      return;
    }
    void this.refreshHistory("played");
  }

  /** Progress shows only for a real track on a non-live program. */
  private updateShowProgress(isLive: boolean): void {
    this.showProgressValue = isRealTrack(this.currentTrackValue) && !isLive;
  }

  /** Installs the listener count when it actually changed. */
  private mergeListeners(next: Listeners): boolean {
    if (this.listenersValue?.value === next.value) return false;
    this.listenersValue = next;
    return true;
  }

  // ── Realtime stream (SSE) ──

  /**
   * Attaches the SSE stream, which replaces the HTTP metadata leg while healthy
   * (the daemon seeds a new connection with the current state); the poll keeps
   * program/history and covers track/listeners past {@link LIVE_STALE_MS}.
   */
  startLive(): void {
    if (
      !this.options.fetchers.subscribeLive ||
      this.disposed ||
      this.suspended ||
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
          if (!this.admitLive()) return;
          this.lastLiveEventAt = Date.now();
        },
        onError: (error) => {
          // The client reconnects itself; the stale marker re-routes the poll.
          console.warn("[NowPlayingRepository] live stream error:", error);
          this.lastLiveEventAt = null;
          this.liveTrackCurrent = false;
        },
      },
    );
  }

  /** Rebuilds the live client when the cover quality changed (baked into its mapper). */
  private ensureLiveCurrent(): void {
    if (this.disposed || !this.liveSubscription) return;
    const quality = this.options.getCoverQuality();
    if (quality === this.liveQuality) return;
    this.stopLive();
    this.startLive();
  }

  /**
   * Switches the automatic work on or off (the background-idle policy).
   * Idempotent. Off suspends everything; on re-attaches the stream, and the
   * caller owns the catch-up (read `isSuspended` before the call).
   */
  setLiveStreamActive(active: boolean): void {
    if (active) {
      this.suspended = false;
      this.startLive();
      return;
    }
    this.suspend();
  }

  private suspend(): void {
    this.suspended = true;
    this.stopLive();
    this.cancelTrackEndTimer();
    this.overdueRefreshes = 0;
    this.retryScheduler.reset();
    this.refreshFailureStreak = 0;
    // Invalidate a run in flight like the watchdog: a resume before it settles
    // would take its stale payload, and its latch would no-op the resume's own
    // refresh (with no foreground tick to retry a lock-screen play).
    if (this.refreshing) {
      this.refreshEpoch++;
      this.refreshing = false;
      this.options.fetchers.abortInFlightRequests();
    }
  }

  /** Gate for every SSE event: a refusal suspends and drops the event. */
  private admitLive(): boolean {
    if (this.disposed || this.suspended) return false;
    if (this.shouldStayLive()) return true;
    this.suspend();
    return false;
  }

  private stopLive(): void {
    const unsubscribe = this.liveSubscription;
    this.liveSubscription = null;
    this.lastLiveEventAt = null;
    this.liveTrackCurrent = false;
    unsubscribe?.();
  }

  /** A `song_change` push: the merge half of `refresh()`, driven by the stream. */
  private ingestSong(song: LiveNowPlaying): void {
    if (!this.admitLive()) return;
    this.lastLiveEventAt = Date.now();
    // Only a payload naming a track vouches for it; the offline placeholder
    // leaves the old one in place for the poll to re-check. Filler becomes
    // current too, like the HTTP leg.
    this.liveTrackCurrent = song.track != null;

    const track = song.track;
    let trackChanged = false;
    if (track && this.trackIdentityChanged(track)) {
      this.applyTrack(track);
      trackChanged = true;
      // Recomputed here too, or the seek bar stays off after a filler push.
      this.updateShowProgress(this.currentProgramValue?.isLive ?? false);
    }

    const listenersChanged = this.mergeListeners(song.listeners);

    if (trackChanged || listenersChanged) {
      this.onChange({
        trackChanged,
        programChanged: false,
        listenersChanged,
        playedChanged: false,
        requestedChanged: false,
      });
    }
    this.scheduleTrackEndRefresh();
  }

  /** Realtime ingestion of a deduped `listeners` push. */
  private ingestListeners(listeners: Listeners): void {
    if (!this.admitLive()) return;
    this.lastLiveEventAt = Date.now();
    if (!this.mergeListeners(listeners)) return;
    this.onChange({
      trackChanged: false,
      programChanged: false,
      playedChanged: false,
      requestedChanged: false,
      listenersChanged: true,
    });
  }

  /**
   * The HTTP poll. `forceMetadata`: a heard title the data does not name, so
   * the stream missed an item — run the metadata leg even while it looks
   * healthy, after any run in flight (which may have skipped that leg).
   */
  async refresh(options: { forceMetadata?: boolean } = {}): Promise<boolean> {
    if (this.disposed || this.suspended) return false;
    if (options.forceMetadata) this.liveTrackCurrent = false;
    if (this.refreshing) {
      const inFlight = this.inFlight;
      if (!options.forceMetadata || !inFlight) return false;
      return inFlight.then(() => this.refresh(options));
    }
    const run = this.runRefresh();
    this.inFlight = run;
    return run.finally(() => {
      if (this.inFlight === run) this.inFlight = null;
    });
  }

  private async runRefresh(): Promise<boolean> {
    this.refreshing = true;
    this.refreshEpoch += 1;
    const epoch = this.refreshEpoch;
    this.refreshStartedAt = Date.now();

    // A healthy stream with a track skips the HTTP metadata leg.
    this.ensureLiveCurrent();
    const liveFresh = this.isLiveAuthoritative();

    try {
      // Independent legs: one endpoint down must not discard the others' data.
      const [metadata, program, newRequestedTracks] = await Promise.allSettled([
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

      // Invalidated while in flight (watchdog, dispose, suspend): write nothing.
      if (this.isRefreshInvalidated(epoch)) return false;

      // A push may have landed meanwhile: the HTTP payload must not walk it back.
      const liveOwns = this.isLiveAuthoritative();

      // Before the merge: a skipped payload must not swallow a sibling's failure.
      const failures = collectRefreshFailures(
        metadata,
        program,
        newRequestedTracks,
        liveOwns,
      );

      const applied = this.applySettledRefresh(
        metadata,
        program,
        newRequestedTracks,
        liveOwns,
      );
      if (!applied) {
        // Skipped payload, but a failed sibling leg still needs its retry.
        if (failures.length > 0) {
          this.reportRefreshFailure(failures[0]);
          this.scheduleRetry();
        }
        return false;
      }

      if (failures.length > 0) {
        // Keep what arrived, retry the rest; the applied part may have moved
        // the track, so re-aim the track-end timer (its own timer).
        this.reportRefreshFailure(failures[0]);
        this.scheduleRetry();
        this.scheduleTrackEndRefresh();
        return false;
      }

      this.reportRefreshRecovered();
      this.retryScheduler.reset();
      this.scheduleTrackEndRefresh();

      // Only identity changes count (listener ticks never re-push metadata).
      return applied.trackChanged || applied.programChanged;
    } catch (error) {
      if (this.isRefreshInvalidated(epoch)) return false;

      this.reportRefreshFailure(error);
      this.scheduleRetry();

      return false;
    } finally {
      // Only the current run releases the latch, not an expired one's settler.
      if (epoch === this.refreshEpoch) this.refreshing = false;
    }
  }

  /** A run is stale once a newer one started, or the repository went away. */
  private isRefreshInvalidated(epoch: number): boolean {
    return epoch !== this.refreshEpoch || this.disposed || this.suspended;
  }

  private scheduleRetry(): void {
    this.retryScheduler.schedule(() => {
      void this.refresh().catch(console.error);
    });
  }

  /** Merges one run's settled legs; `null` when the metadata leg named no track. */
  private applySettledRefresh(
    metadata: PromiseSettledResult<{
      track: Track | null;
      listeners: Listeners | null;
    }>,
    program: PromiseSettledResult<Program>,
    newRequestedTracks: PromiseSettledResult<Track[]>,
    liveOwns: boolean,
  ): { trackChanged: boolean; programChanged: boolean } | null {
    const track = metadata.status === "fulfilled" ? metadata.value.track : null;

    // Succeeded with no track (a failed leg is the caller's): not retried.
    if (!liveOwns && metadata.status === "fulfilled" && !track) {
      console.warn(
        "[NowPlayingRepository] API returned invalid track data, skipping update",
      );
      return null;
    }

    return this.applyRefreshPayload({
      track,
      listeners:
        metadata.status === "fulfilled" ? metadata.value.listeners : null,
      program: program.status === "fulfilled" ? program.value : null,
      newRequestedTracks:
        newRequestedTracks.status === "fulfilled"
          ? newRequestedTracks.value
          : null,
      liveOwns,
    });
  }

  /**
   * Logs a failed run once per streak. Typed API failures (an outage) are one
   * `warn` line; anything else is a bug and keeps `error` with the object.
   */
  private reportRefreshFailure(error: unknown): void {
    this.refreshFailureStreak += 1;
    if (this.refreshFailureStreak > 1) return;

    if (error instanceof AnimuApiError) {
      const code = error.code ? ` code=${error.code}` : "";
      const url = error.url ? ` url=${error.url}` : "";
      console.warn(
        `[NowPlayingRepository] refresh failed: ${error.message}${code}${url}`,
      );
      return;
    }
    console.error("[NowPlayingRepository] refresh failed:", error);
  }

  /** Closes a failure streak with a single line; silent when there was none. */
  private reportRefreshRecovered(): void {
    if (this.refreshFailureStreak === 0) return;
    const failedRuns = this.refreshFailureStreak;
    this.refreshFailureStreak = 0;
    console.info(
      `[NowPlayingRepository] refresh recovered after ${failedRuns} failed run(s)`,
    );
  }

  /** The stream owns track/listeners: it delivered a track, no error since, and is fresh. */
  private isLiveAuthoritative(): boolean {
    const vouchesForTrack =
      this.liveSubscription != null && this.liveTrackCurrent && this.currentTrackValue != null;
    return (
      vouchesForTrack &&
      this.lastLiveEventAt != null &&
      Date.now() - this.lastLiveEventAt <= LIVE_STALE_MS
    );
  }

  /**
   * Writes one poll's payload and notifies once; returns the identity changes.
   * A `null` leg failed: the previous value stays, so an outage never blanks the UI.
   */
  private applyRefreshPayload(payload: {
    track: Track | null;
    listeners: Listeners | null | undefined;
    program: Program | null;
    newRequestedTracks: Track[] | null;
    liveOwns: boolean;
  }): { trackChanged: boolean; programChanged: boolean } {
    const { track, listeners, program, newRequestedTracks, liveOwns } = payload;
    let trackChanged = false;

    if (track && !liveOwns && this.trackIdentityChanged(track)) {
      this.applyTrack(track);
      trackChanged = true;
    }

    let programChanged = false;
    if (program != null) {
      programChanged = this.programIdentityChanged(program);
      if (programChanged) this.currentProgramValue = program;
    }

    // On either change: a live block starting with the same track on air
    // must still flip the seek bar.
    if (trackChanged || programChanged) {
      this.updateShowProgress(
        program?.isLive ?? this.currentProgramValue?.isLive ?? false,
      );
    }

    // Same live-authority rule: a stale HTTP count must not regress a push.
    const listenersChanged =
      !liveOwns && listeners != null && this.mergeListeners(listeners);

    // The requests list mirrors the feed; compared row by row (`raw`), so the
    // same song requested twice in a row still updates it.
    const requestedChanged =
      newRequestedTracks != null &&
      newRequestedTracks.length > 0 &&
      (newRequestedTracks.length !== this.requestedTracks.length ||
        newRequestedTracks.some((track, i) => track.raw !== this.requestedTracks[i].raw));
    if (requestedChanged) {
      this.requestedTracks = newRequestedTracks;
    }

    // A track change's played-history fetch reports its own flag.
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

    return { trackChanged, programChanged };
  }

  /**
   * Watchdog, driven by the native 1 Hz heartbeat: expires a run older than
   * `REFRESH_STALE_MS`. In the background a stalled fetch never settles (its
   * abort is a frozen JS timer), and the latch would freeze all now-playing data.
   */
  expireStuckRefresh(): void {
    if (!this.refreshing) return;
    if (Date.now() - this.refreshStartedAt <= REFRESH_STALE_MS) return;
    console.warn(
      `[NowPlayingRepository] expired stuck refresh after ${
        Date.now() - this.refreshStartedAt
      }ms — releasing latch`,
    );
    this.refreshEpoch++;
    this.refreshing = false;
    // Cut the hung sockets loose; the next poll opens fresh connections.
    this.options.fetchers.abortInFlightRequests();
  }

  /**
   * Heartbeat for the live stream's JS timers (reconnect, dead socket), which
   * do not run in the background on Android: a dropped stream would stay down.
   */
  tickLive(): void {
    if (this.disposed || !this.liveSubscription) return;
    this.options.fetchers.tickLive?.();
  }

  /**
   * Incrementally merges a history type into its list: the feed's rows join
   * the kept ones newest-first, one row per song (`raw`), so a song played
   * again moves up with its new start. The walk stops at the first feed row
   * older than a day — everything after it is older still.
   */
  async refreshHistory(type: HistoryType): Promise<void> {
    if (this.disposed || this.suspended) return;
    try {
      const tracks = await this.options.fetchers.getTrackHistory(
        type,
        this.options.getCoverQuality(),
        this.options.getDefaultCover(),
      );
      if (type === "played") this.playedStale = false;
      if (tracks.length === 0) return;

      const target =
        type === "requests" ? this.requestedTracks : this.playedTracks;

      const recent: Track[] = [];
      for (const track of tracks) {
        if (Date.now() - track.startTime.getTime() > DAY_MS) break;
        recent.push(track);
      }
      const merged = firstOccurrences(
        [...recent, ...target].sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
      ).slice(0, MAX_HISTORY_TRACKS);
      const unchanged =
        merged.length === target.length &&
        merged.every(
          (track, i) => track.raw === target[i].raw && track.startTime.getTime() === target[i].startTime.getTime(),
        );
      if (unchanged) return;

      if (type === "requests") {
        this.requestedTracks = merged;
      } else {
        this.playedTracks = merged;
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
   * Predictive refresh just after the real, non-live track ends on the
   * station's clock (`getNow`). A track already past its end is re-checked
   * after 1 s, then with a doubling (capped) delay while it stays on air.
   */
  scheduleTrackEndRefresh(): void {
    this.cancelTrackEndTimer();
    if (this.suspended) return;

    const track = this.currentTrackValue;
    if (!track || track.duration <= 0) return;
    if (!isRealTrack(track)) return;
    if (this.currentProgramValue?.isLive) return;

    const now = this.options.getNow?.() ?? Date.now();
    const msUntilEnd = track.startTime.getTime() + track.duration - now;
    const overdue = msUntilEnd <= 0;
    const delay = overdue
      ? Math.min(
          TRACK_END_REFRESH_SOON_MS * 2 ** this.overdueRefreshes,
          TRACK_END_REFRESH_MAX_MS,
        )
      : msUntilEnd + TRACK_END_BUFFER_MS;

    this.trackEndTimerId = this.options.timer.set(() => {
      this.trackEndTimerId = null;
      // Counted when it fires: re-arming without a run must not advance it.
      if (overdue) this.overdueRefreshes++;
      void this.refresh().catch(console.error);
    }, delay);
  }

  /** Stops for good: no timer re-arms and no fetch emits after teardown. */
  dispose(): void {
    this.disposed = true;
    this.stopLive();
    this.cancelTrackEndTimer();
    this.retryScheduler.reset();
    this.refreshFailureStreak = 0;
  }

  /** Clears all now-playing data (destroy path). */
  clear(): void {
    this.currentTrackValue = null;
    this.overdueRefreshes = 0;
    this.currentProgramValue = null;
    this.listenersValue = null;
    this.playedTracks = [];
    this.requestedTracks = [];
    this.recentOnAir = [];
    this.showProgressValue = false;
    this.playedStale = false;
  }

  private cancelTrackEndTimer(): void {
    this.options.timer.clear(this.trackEndTimerId);
    this.trackEndTimerId = null;
  }
}
