import type {
  ArtworkQuality,
  HistoryType,
  Listeners,
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

/** What the repository needs from the network — injectable for tests. */
export interface NowPlayingFetchers {
  getStreamMetadata(
    artworkQuality?: ArtworkQuality,
  ): Promise<{ track: Track | null; listeners: Listeners }>;
  getCurrentProgram(): Promise<Program>;
  getTrackHistory(type: HistoryType): Promise<Track[]>;
}

export interface NowPlayingRepositoryOptions {
  fetchers: NowPlayingFetchers;
  /** Runtime user setting — cover artwork quality. */
  getCoverQuality: () => ArtworkQuality;
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

  private currentTrackValue: Track | null = null;
  private currentProgramValue: Program | null = null;
  private listenersValue: Listeners | null = null;
  private playedTracks: Track[] = [];
  private requestedTracks: Track[] = [];
  private showProgressValue = false;
  private refreshing = false;
  private trackEndTimerId: number | null = null;
  private readonly retryScheduler: BackoffScheduler;

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

  // ── Commands ──

  /**
   * Fetches track + program + listeners + request history in parallel and
   * merges with diffing. Failures schedule an exponential-backoff retry;
   * successes reset it and re-arm the predictive track-end refresh.
   */
  async refresh(): Promise<boolean> {
    if (this.refreshing) return false;
    this.refreshing = true;

    try {
      const [{ track, listeners }, program, newRequestedTracks] =
        await Promise.all([
          this.options.fetchers.getStreamMetadata(
            this.options.getCoverQuality(),
          ),
          this.options.fetchers.getCurrentProgram(),
          this.options.fetchers.getTrackHistory("requests"),
        ]);

      if (!track) {
        console.warn(
          "[NowPlayingRepository] API returned invalid track data, skipping update",
        );
        return false;
      }

      let trackChanged = false;

      if (
        this.currentTrackValue?.raw !== track.raw ||
        this.currentTrackValue?.artwork !== track.artwork
      ) {
        this.currentTrackValue = track;
        trackChanged = true;

        void this.refreshHistory("played");

        // Enable progress for real, non-live tracks (radio keeps playing
        // server-side so we always show progress).
        this.showProgressValue = isRealTrack(track) && !program.isLive;
      }

      const programChanged =
        this.currentProgramValue?.name !== program.name ||
        this.currentProgramValue?.dj !== program.dj ||
        this.currentProgramValue?.isLive !== program.isLive;
      if (programChanged) this.currentProgramValue = program;

      const listenersChanged = this.listenersValue?.value !== listeners.value;
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

      return changed;
    } catch (error) {
      console.error("[NowPlayingRepository] Error refreshing data:", error);

      // ── Network / API error: exponential backoff retry ──
      this.retryScheduler.schedule(() => {
        void this.refresh().catch(console.error);
      });

      return false;
    } finally {
      this.refreshing = false;
    }
  }

  /**
   * Incrementally merges a history type into its list: new tracks are
   * unshifted, already-known tracks stop the walk once they're older than
   * a day (everything after is guaranteed older). The merged list is
   * replaced with a shallow copy so store snapshots can diff by reference.
   */
  async refreshHistory(type: HistoryType): Promise<void> {
    const target =
      type === "requests" ? this.requestedTracks : this.playedTracks;

    try {
      const tracks = await this.options.fetchers.getTrackHistory(type);
      if (!tracks || tracks.length === 0) return;

      let added = false;
      for (const track of tracks) {
        if (!target.find((t) => t.raw === track.raw)) {
          target.unshift(track);
          added = true;
        } else if (Date.now() - track.startTime.getTime() > DAY_MS) {
          break;
        }
      }
      if (!added) return;

      if (type === "requests") {
        this.requestedTracks = [...this.requestedTracks];
      } else {
        this.playedTracks = [...this.playedTracks];
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

  /** Cancels the track-end timer and the retry chain (destroy path). */
  cancelPending(): void {
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
