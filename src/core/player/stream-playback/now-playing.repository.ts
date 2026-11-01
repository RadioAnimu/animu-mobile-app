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
/**
 * Cap on each in-memory history feed. A radio left on all day accumulates a
 * track every few minutes; without a cap the arrays (and the O(n) dedup walk
 * over them) grow for the whole session. Far more rows than anyone scrolls.
 */
const MAX_HISTORY_TRACKS = 300;
/**
 * How many on-air items the repository remembers after the current one,
 * filler included. An ICY title is heard a stream lag after the station
 * announced it, so a jingle shorter than the lag (the 4–5 s request jingle)
 * is already replaced by the next item when it is heard — and the played
 * history drops filler. A few items cover any lag a relay can have.
 */
const MAX_RECENT_ON_AIR = 10;
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
 * Picks the legs that actually failed out of one refresh run. A metadata
 * failure whose data the live stream owns is not an outage: its stale HTTP
 * answer is discarded exactly like a successful stale payload would be.
 */
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
   * Fires the live client's overdue reconnect / idle timeout (JS timers,
   * frozen in the background on Android). Optional like `subscribeLive`.
   */
  tickLive?(): void;
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
  /**
   * The station-timeline "now" (epoch ms) used to schedule the predictive
   * track-end refresh. Defaults to `Date.now`; the player injects the live
   * point on the server's clock (the device clock plus the applied skew), so
   * the refresh fires when the *station* crosses the track's end — it is
   * about the station's data, and there may be no audio at all (not the
   * audible clock, which trails the live edge by the stream lag and exists
   * only while playing). Tests leave it unset for a real clock.
   */
  getNow?: () => number;
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
   * Wired by the orchestrator: may the realtime stream keep running? Asked
   * before every SSE event is ingested (song, listeners, open). Answering
   * `false` drops the event untouched and suspends the repository (see
   * {@link setLiveStreamActive}) — the event is the only code that runs in
   * the background once JS timers are frozen, so it is where a deadline can
   * be enforced.
   */
  shouldStayLive: () => boolean = () => true;
  /**
   * Wired by the orchestrator: nothing visible needs the station extras right
   * now (the app is hidden and no audio is wanted). A track change then skips
   * the played-history fetch, and {@link historyStale} remembers it so the
   * return can catch up.
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
  /** Bumped by every new run AND by the watchdog — late settlers compare. */
  private refreshEpoch = 0;
  private refreshStartedAt = 0;
  private trackEndTimerId: number | null = null;
  /**
   * Overdue refreshes already run for the current track identity. A track
   * the station keeps reporting past its metadata end (long song, metadata
   * lag, gap between songs) would otherwise be re-fetched every second for
   * as long as it stays overdue. Reset when the identity changes.
   */
  private overdueRefreshes = 0;
  private disposed = false;
  /**
   * Automatic station work is switched off ({@link setLiveStreamActive}
   * `false`): no SSE, no predictive track-end refresh, no retry backoff, and
   * `refresh()` is a no-op. A run already in flight is dropped when it
   * settles — its late completion can neither write state nor re-arm a
   * timer. Cleared by `setLiveStreamActive(true)`.
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
   * The stream's last `song_change` is the station's current item. Cleared by
   * a live error — a song payload that failed validation is dropped there, and
   * the daemon only sends the next one at the next title change — until a
   * song lands again. `listeners` pushes keep the stream fresh but can't
   * vouch for the track, so the poll's HTTP leg stays on meanwhile.
   */
  private liveTrackCurrent = false;
  /**
   * Consecutive failed refresh runs. Failures are logged once per streak —
   * the backoff chain re-runs every few seconds, so one line per attempt is
   * what turned an upstream outage into a log flood. Reset on success and
   * whenever automatic work is suspended or torn down.
   */
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

  /**
   * The items on air before the current one, newest first — jingles, idents
   * and transitions included, with their station timing. What a heard ICY
   * title is matched against once the station has moved past it.
   */
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
      this.currentTrackValue?.artwork !== track.artwork
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
      this.currentProgramValue?.dj !== program.dj ||
      this.currentProgramValue?.isLive !== program.isLive ||
      this.currentProgramValue?.acceptingRequests !== program.acceptingRequests
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
    // Nobody is looking at the history (hidden, nothing playing): skip the
    // request, the return catches up.
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
          // Fresh connection (or reconnect) — drop the stale marker so the
          // next poll trusts the live source again.
          this.lastLiveEventAt = Date.now();
        },
        onError: (error) => {
          // The client reconnects with its own backoff; this only logs.
          // The stale marker below is what re-routes the poll to HTTP.
          console.warn("[NowPlayingRepository] live stream error:", error);
          this.lastLiveEventAt = null;
          this.liveTrackCurrent = false;
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
   * Switches the station's automatic work on or off (the background-idle
   * policy; see `BackgroundIdle`). Safe on any lifecycle stage and idempotent
   * in both directions.
   *
   * Off = **suspended**: the SSE closes, the predictive track-end refresh and
   * the retry backoff are cancelled, and nothing re-arms them until it is
   * back on. On = the stream is re-attached (the daemon seeds the current
   * state); the caller owns the catch-up fetches (`isSuspended` tells it a
   * resume is happening, read before the call).
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
    // A run in flight belongs to the session being put to sleep. Left alone,
    // a resume before it settles would let its stale payload through the
    // guard (over the fresh stream's state) and its latch would turn the
    // resume's own refresh into a no-op — with no foreground tick to retry
    // when the resume is a lock-screen play. Invalidate it like the watchdog.
    if (this.refreshing) {
      this.refreshEpoch++;
      this.refreshing = false;
      this.options.fetchers.abortInFlightRequests();
    }
  }

  /**
   * Gate for every SSE event: ask the orchestrator whether the stream may
   * keep running. A refusal closes it on the spot — the event that carried
   * the news is dropped with no state write and no side effect.
   */
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

  /**
   * Realtime ingestion of a `song_change` push. Semantically the merge half
   * of `refresh()` — same diffing, same change events — just driven by the
   * stream instead of the poll. Runs synchronously (no epoch guard: the
   * source is a push, not a fetch).
   */
  private ingestSong(song: LiveNowPlaying): void {
    if (!this.admitLive()) return;
    this.lastLiveEventAt = Date.now();
    // Only a payload naming a track vouches for it: the offline placeholder
    // (no track) leaves the old one in place, which the poll must re-check.
    this.liveTrackCurrent = song.track != null;

    // Follow the station's on-air item exactly like the HTTP leg did: real
    // songs AND filler (jingles/idents/transitions) both become current, so
    // the UI and the media session track the broadcast instead of freezing
    // on the previous song. Only a payload with no track at all (offline
    // placeholder) leaves the current state untouched.
    const track = song.track;
    let trackChanged = false;
    if (track && this.trackIdentityChanged(track)) {
      this.applyTrack(track);
      trackChanged = true;
      // Progress follows the poll's rule: a seek bar only for real,
      // non-live tracks. Recomputing here is what keeps the media
      // session's bar from staying stuck off after a live push (filler
      // or a live block can flip it off before the next poll lands).
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
   * ── HTTP poll, invalidated by live data past the staleness window ──
   *
   * `forceMetadata`: the player heard a title the station data does not
   * name, so the live stream evidently missed an item (it sends each one
   * once). The HTTP metadata leg runs even while the stream looks healthy,
   * and its track wins unless a `song_change` lands meanwhile. A run already
   * in flight may have skipped that leg, so a forced call runs after it.
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

    // Live healthy → skip the HTTP metadata leg; ingest already owns
    // track/listeners and re-writes them on the next push. A live track is
    // required for the skip: while the stream only pushed placeholders
    // (offline station), the HTTP leg must still have its chance to fill
    // state exactly like it did before SSE existed.
    this.ensureLiveCurrent();
    const liveFresh = this.isLiveAuthoritative();

    try {
      // The three legs are independent: one endpoint being down must not
      // discard the other two's fresh data. `metadata` can never fail on a
      // live skip leg (it is a snapshot), so a rejection here means the
      // HTTP metadata call itself failed.
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

      // Invalidated while in flight (watchdog expiry, dispose or suspend):
      // the stuck run's late settler must not write state or re-arm timers —
      // a newer run already owns the repository, or nobody does.
      if (this.isRefreshInvalidated(epoch)) return false;

      // Same protection against the LIVE source: this HTTP run started on
      // a stale stream, but a song_change push may have landed while it
      // was in flight — pushing authoritative state. The stale HTTP
      // payload must not walk the live data backwards.
      const liveOwns = this.isLiveAuthoritative();

      // A leg whose data the live stream owns did not really fail: its
      // stale HTTP answer is simply discarded, exactly like its payload.
      // Computed BEFORE the merge decision below: a skipped payload must
      // not swallow a sibling leg's failure that needs its own retry.
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
        // The payload is skipped (no track to install), but a rejected
        // program/requests leg in the same run still failed on its own:
        // before the allSettled split it made the whole run fail and
        // retry, so the retry must survive the skip.
        if (failures.length > 0) {
          this.reportRefreshFailure(failures[0]);
          this.scheduleRetry();
        }
        return false;
      }

      if (failures.length > 0) {
        // Keep what did arrive (the partial payload is applied above), but
        // report the run as failed so the backoff chain retries the rest.
        this.reportRefreshFailure(failures[0]);
        this.scheduleRetry();
        // The applied part may have moved the track (or flipped the program
        // live), leaving the predictive timer pointed at the OLD track's
        // end: recompute it from current state. Its own timer, so this does
        // not disturb the retry chain armed just above.
        this.scheduleTrackEndRefresh();
        return false;
      }

      // ── Success: reset error backoff & schedule track-end refresh ──
      this.reportRefreshRecovered();
      this.retryScheduler.reset();
      this.scheduleTrackEndRefresh();

      // Only identity changes count as "changed": listener/request ticks
      // reach the badge UI through onChange but never re-push metadata.
      return applied.trackChanged || applied.programChanged;
    } catch (error) {
      // Invalidated run: its failure belongs to the past — no logging
      // noise, no retry re-arming over a newer run's head.
      if (this.isRefreshInvalidated(epoch)) return false;

      this.reportRefreshFailure(error);

      // ── Network / API error: exponential backoff retry ──
      this.scheduleRetry();

      return false;
    } finally {
      // Only the current run may release the latch — an expired run's
      // late settler must not unlock a newer run's single-flight guard.
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

  /**
   * Merges one run's settled legs. Returns `null` when the payload must be
   * skipped entirely: the HTTP metadata leg succeeded but named no track,
   * and the live stream cannot vouch for one.
   */
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

    // A *failed* metadata leg is handled by the caller (partial apply +
    // backoff); this is the case where the request succeeded but returned
    // no track, which was never retried.
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
   * Logs a failed refresh run — once per streak. The retry chain re-runs
   * every few seconds while an endpoint is down, so repeating the same line
   * per attempt is what flooded the device log; the recovery line closes the
   * streak. Typed API failures (the expected shape of an outage) stay at
   * `warn` with a single readable line; anything else is a genuine bug and
   * keeps `error` with the object.
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

  /**
   * Whether the live (SSE) source currently owns track/listener state: a
   * subscription exists, it has delivered a track with no error since, and
   * its last event is inside the staleness window.
   */
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
   * Writes one HTTP poll's payload into the repository and notifies once.
   * Only identity changes (track/program) are reported back: listener and
   * request ticks reach the badge UI through `onChange` but never re-push
   * metadata.
   *
   * `program` / `newRequestedTracks` are `null` when that leg failed: the
   * repository keeps its previous value instead of clearing it, so a partial
   * outage never blanks the UI.
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

    // Enable progress for real, non-live tracks (radio keeps playing
    // server-side so we always show progress). Recompute on EITHER change:
    // a live block starting/ending while the same track stays on air must
    // still flip the seek bar off/on. A failed program leg keeps the
    // program already installed.
    if (trackChanged || programChanged) {
      this.updateShowProgress(
        program?.isLive ?? this.currentProgramValue?.isLive ?? false,
      );
    }

    // Same live-authority rule for the listener count: on a skip leg it
    // is the snapshot we just installed out of (never differs); after a
    // mid-flight push, the HTTP count is stale and must not regress it.
    const listenersChanged =
      !liveOwns && listeners != null && this.mergeListeners(listeners);

    const requestedChanged =
      newRequestedTracks != null &&
      newRequestedTracks.length > 0 &&
      newRequestedTracks[0].raw !== (this.requestedTracks[0]?.raw || "");
    if (requestedChanged && newRequestedTracks) {
      this.requestedTracks = newRequestedTracks;
    }

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

    return { trackChanged, programChanged };
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
   * Heartbeat for the live stream's timers, driven by the native 1 Hz
   * readings like {@link expireStuckRefresh}: its reconnect backoff and
   * dead-socket timeout are JS timers, which do not run in the background
   * on Android — a stream dropped there would otherwise stay down until the
   * app returned to the foreground.
   */
  tickLive(): void {
    if (this.disposed || !this.liveSubscription) return;
    this.options.fetchers.tickLive?.();
  }

  /**
   * Incrementally merges a history type into its list.
   *
   * The feed's rows join the kept ones newest-first, one row per song
   * (`raw`): a song played again moves up with its new start, instead of the
   * old row staying put. The walk stops at the first feed row older than a
   * day — everything after it is older still, and only an eviction could
   * have dropped it.
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
      if (!tracks || tracks.length === 0) return;

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
   * Predictive refresh: schedules a fetch right after the current real,
   * non-live track is expected to end (`startTime + duration + buffer`),
   * keeping the UI ahead of the station instead of polling blindly. The
   * delay is measured against the injected `getNow` — the station's live
   * point on the server's clock — so the refresh lands just after the
   * station crosses the track's end, with or without audio playing.
   * A track already past its end is re-checked after 1 s the first time, then
   * with a doubling delay (capped) while the same track stays on air.
   */
  scheduleTrackEndRefresh(): void {
    this.cancelTrackEndTimer();
    if (this.suspended) return;

    const track = this.currentTrackValue;
    if (!track || track.duration <= 0) return;
    // Don't schedule for non-real tracks (jingles, transitions) or live
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
      // Counted when it fires, not when armed: re-arming (partial failure,
      // live push) without a run must not advance the backoff.
      if (overdue) this.overdueRefreshes++;
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
