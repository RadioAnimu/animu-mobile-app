import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Track } from "animu-api";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Storage key for the user's own pending requests. */
export const PENDING_REQUESTS_KEY = "pendingMusicRequests";

/**
 * Fallback staleness horizon. While the app is closed we can't observe
 * request plays, and the "latest requests" feed holds only ~6 rows — proof
 * older than this is unobtainable, so entries are dropped (assumed played).
 */
export const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/** A request the user submitted that has not (yet provably) played. */
export interface PendingRequest {
  /** Station catalog id — the same value submitted as `allmusic`. */
  trackId: string;
  /** Parsed song title, for display. */
  title: string;
  /** Strict epoch (ms) of the successful submission. */
  submittedAt: number;
}

/** What the tracker needs from each station poll — injectable for tests. */
export interface QueueObservation {
  now: number;
  /** Track currently on air (may be a request, AutoDJ song or jingle). */
  onAirTrack: Track | null;
  /** "Latest requests" feed — the last ~6 played requests. */
  playedRequests: Track[];
}

/** The provable state of the user's own requests. */
export interface QueueStatus {
  /** Own requests still queued, oldest submission first. */
  pending: PendingRequest[];
  /**
   * Conservative lower bound of requests that were ahead of the newest
   * pending one — distinct request plays observed since its submission.
   */
  playedAhead: number;
  /** The user's own request currently on air, if any. */
  playingNow: PendingRequest | null;
  /**
   * Rough "requests play about every M ms" hint from the played feed
   * (null while unknown — needs ≥2 feed plays).
   */
  cadenceMs: number | null;
}

/** Minimal persistence seam — injectable for tests. */
export interface QueueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

const asyncStorage: QueueStorage = {
  async get(key) {
    return AsyncStorage.getItem(key);
  },
  async set(key, value) {
    await AsyncStorage.setItem(key, value);
  },
};

/**
 * Feed timestamps carry time-of-day only and the mapper date-stamps them
 * with "today". A built epoch in the future relative to `now` actually
 * happened yesterday — shift it back a day before comparing (R4).
 */
export function normalizePlayEpoch(builtEpoch: number, now: number): number {
  return builtEpoch <= now ? builtEpoch : builtEpoch - DAY_MS;
}

/**
 * Tracks the user's OWN music requests and reports the provable part of
 * the station queue.
 *
 * Business reality (why this is a lower bound, never an exact position):
 * the station exposes no pending-queue endpoint. The "latest requests"
 * feed is a played history — the last ~6 requests that played, timestamped
 * with time-of-day only. What follows is encoded as rules:
 *
 * R1 — Identity: a request is identified by the station's catalog track id
 *      (the `allmusic` value submitted, also the feed row id).
 * R2 — Same song, multiple requesters: the feed collapses concurrent
 *      requests of the same song into one play row — matching by track id
 *      proves "this song played", which is enough to consume the entry.
 * R3 — FIFO frontier: requests are consumed in submission order, so any
 *      distinct request play observed after our submission and before ours
 *      plays was necessarily pending before ours → genuinely ahead of it.
 *      Reported as "≥ N played ahead of yours".
 * R4 — Midnight masquerade: see {@link normalizePlayEpoch}. Counting raw
 *      built epochs instead is what made yesterday's plays show up as
 *      "in the queue" forever.
 * R5 — Closed-app blindness: see {@link DEFAULT_STALE_AFTER_MS}.
 */
export class QueueTracker {
  private pendingValue: PendingRequest[] = [];
  private playingNowValue: PendingRequest | null = null;
  private cadenceValue: number | null = null;
  /** Distinct request plays already counted toward the frontier (R3). */
  private countedPlays = new Map<string, number>();

  constructor(
    private readonly storage: QueueStorage = asyncStorage,
    private readonly staleAfterMs: number = DEFAULT_STALE_AFTER_MS,
  ) {}

  /** Loads persisted pendings, dropping entries past the staleness horizon. */
  async load(now: number = Date.now()): Promise<void> {
    try {
      const raw = await this.storage.get(PENDING_REQUESTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingRequest[];
      if (Array.isArray(parsed)) {
        this.pendingValue = parsed
          .filter((entry) => isPendingRequest(entry) && !this.isStale(entry, now))
          .sort(bySubmittedAt);
      }
    } catch (error) {
      console.warn("[QueueTracker] Failed to load pending requests:", error);
      this.pendingValue = [];
    }
  }

  /**
   * Records a successful submission. Duplicate track ids keep the OLDEST
   * submission — it is the one closer to playing (R1; the server blocks
   * same-song re-requests anyway).
   */
  async add(
    trackId: string,
    title: string,
    submittedAt: number = Date.now(),
  ): Promise<void> {
    const existing = this.pendingValue.find(
      (entry) => entry.trackId === trackId,
    );
    if (existing) return;
    this.pendingValue = [
      ...this.pendingValue,
      { trackId, title, submittedAt },
    ].sort(bySubmittedAt);
    try {
      await this.storage.set(
        PENDING_REQUESTS_KEY,
        JSON.stringify(this.pendingValue),
      );
    } catch (error) {
      console.warn("[QueueTracker] Failed to persist pending request:", error);
    }
  }

  /**
   * Merges one station poll: consumes played entries, ages out stale ones
   * and advances the FIFO frontier. Cheap — call on every poll change.
   */
  observe(observation: QueueObservation): QueueStatus {
    const { now, onAirTrack, playedRequests } = observation;

    // Distinct play events from the feed, midnight-normalized (R4),
    // chronological after normalization
    const feedPlays = playedRequests
      .map((track) => ({
        trackId: track.id,
        playEpoch: normalizePlayEpoch(track.startTime.getTime(), now),
      }))
      .filter((play) => play.trackId !== "0" && play.trackId !== "-1")
      .sort((a, b) => a.playEpoch - b.playEpoch);

    // Cadence hint from the observed window
    this.cadenceValue =
      feedPlays.length >= 2
        ? (feedPlays[feedPlays.length - 1].playEpoch - feedPlays[0].playEpoch) /
          (feedPlays.length - 1)
        : null;

    // The on-air track is the strictest evidence (strict epoch timestart)
    const onAirPlay = onAirTrack?.isRequest
      ? { trackId: onAirTrack.id, playEpoch: onAirTrack.startTime.getTime() }
      : null;

    // R3 — frontier baseline: the newest pending submission. Any distinct
    // play at/after it was necessarily pending before it (FIFO).
    const newestSubmission = this.pendingValue.length
      ? this.pendingValue[this.pendingValue.length - 1].submittedAt
      : null;

    // Count new distinct plays toward the frontier
    for (const play of onAirPlay ? [onAirPlay, ...feedPlays] : feedPlays) {
      const key = `${play.trackId}@${play.playEpoch}`;
      if (!this.countedPlays.has(key)) this.countedPlays.set(key, play.playEpoch);
    }

    // Consume played pendings (R2) and stale ones (R5)
    const stillPending: PendingRequest[] = [];
    let playingNow: PendingRequest | null = null;

    for (const entry of this.pendingValue) {
      if (this.isStale(entry, now)) continue; // R5 — dropped, assumed played

      const played =
        (onAirPlay != null &&
          onAirPlay.trackId === entry.trackId &&
          onAirPlay.playEpoch >= entry.submittedAt) ||
        feedPlays.some(
          (play) =>
            play.trackId === entry.trackId &&
            play.playEpoch >= entry.submittedAt,
        );

      if (played && !playingNow) {
        // The most recently played own entry reads as "on air" for the
        // poll window; older ones simply drop off.
        playingNow = entry;
        continue;
      }
      if (played) continue;
      stillPending.push(entry);
    }

    this.pendingValue = stillPending;
    this.playingNowValue = playingNow;

    // Prune frontier evidence that no longer matters: plays older than the
    // newest pending submission, once rotated out of the feed (~6 rows)
    if (newestSubmission != null) {
      for (const [key, playEpoch] of this.countedPlays) {
        if (playEpoch >= newestSubmission) continue;
        if (!feedStillContains(feedPlays, key)) this.countedPlays.delete(key);
      }
    }

    const playedAhead =
      newestSubmission != null
        ? [...this.countedPlays.values()].filter(
            (playEpoch) => playEpoch >= newestSubmission,
          ).length
        : 0;

    return {
      pending: stillPending,
      playedAhead,
      playingNow: this.playingNowValue,
      cadenceMs: this.cadenceValue,
    };
  }

  /** Last computed status — synchronous read for render. */
  get status(): QueueStatus {
    const newestSubmission = this.pendingValue.length
      ? this.pendingValue[this.pendingValue.length - 1].submittedAt
      : null;
    return {
      pending: this.pendingValue,
      playedAhead:
        newestSubmission != null
          ? [...this.countedPlays.values()].filter(
              (playEpoch) => playEpoch >= newestSubmission,
            ).length
          : 0,
      playingNow: this.playingNowValue,
      cadenceMs: this.cadenceValue,
    };
  }

  private isStale(entry: PendingRequest, now: number): boolean {
    return now - entry.submittedAt > this.staleAfterMs;
  }
}

/** Prune helper — keep plays the feed still evidences (feed is only ~6 rows). */
function feedStillContains(
  feedPlays: { trackId: string; playEpoch: number }[],
  key: string,
): boolean {
  return feedPlays.some((play) => `${play.trackId}@${play.playEpoch}` === key);
}

function isPendingRequest(value: unknown): value is PendingRequest {
  const entry = value as PendingRequest;
  return (
    typeof entry?.trackId === "string" &&
    typeof entry?.title === "string" &&
    typeof entry?.submittedAt === "number" &&
    Number.isFinite(entry.submittedAt)
  );
}

function bySubmittedAt(a: PendingRequest, b: PendingRequest): number {
  return a.submittedAt - b.submittedAt;
}
