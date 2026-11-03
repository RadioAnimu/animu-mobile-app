import type { HistoryType } from "animu-api";
import type { Track } from "@/core/domain/track";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cap on each in-memory history feed (a radio left on all day keeps growing them). */
const MAX_HISTORY_TRACKS = 300;

/** Payload order preserved; repeats of a `raw` keep only their first (newest) row. */
function firstOccurrences(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.raw)) return false;
    seen.add(track.raw);
    return true;
  });
}

/** The played and requested lists, and the rule each one follows. */
export class TrackHistory {
  private playedTracks: Track[] = [];
  private requestedTracks: Track[] = [];

  get played(): Track[] {
    return this.playedTracks;
  }

  get requested(): Track[] {
    return this.requestedTracks;
  }

  /**
   * Incrementally merges a feed into its list; whether the list changed. The
   * feed's rows join the kept ones newest-first, one row per song (`raw`), so
   * a song played again moves up with its new start. The walk stops at the
   * first feed row older than a day — everything after it is older still.
   */
  merge(type: HistoryType, feed: Track[]): boolean {
    if (feed.length === 0) return false;
    const target = type === "requests" ? this.requestedTracks : this.playedTracks;

    const recent: Track[] = [];
    for (const track of feed) {
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
    if (unchanged) return false;

    if (type === "requests") {
      this.requestedTracks = merged;
    } else {
      this.playedTracks = merged;
    }
    return true;
  }

  /**
   * The requests list mirrors the feed (the poll's); whether it changed.
   * Compared row by row (`raw`), so the same song requested twice in a row
   * still updates it.
   */
  mirrorRequests(feed: Track[]): boolean {
    const current = this.requestedTracks;
    if (feed.length === 0) return false;
    if (feed.length === current.length && feed.every((track, i) => track.raw === current[i].raw)) return false;
    this.requestedTracks = feed;
    return true;
  }

  clear(): void {
    this.playedTracks = [];
    this.requestedTracks = [];
  }
}
