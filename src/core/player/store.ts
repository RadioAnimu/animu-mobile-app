import { Track } from "@/core/domain/track";
import { Stream } from "@/core/domain/stream";
import { Listeners } from "@/core/domain/listeners";
import { Program } from "@/core/domain/program";
import { createStore } from "@/core/external-store";

/**
 * The transport as the UI sees it. `isPlaying` alone can't express
 * "reconnecting"; consumers that only care about play/pause read `isPlaying`.
 */
export type TransportState =
  | "idle" // nothing loaded yet / torn down
  | "connecting" // play requested, no audio yet
  | "playing" // audio flowing
  | "paused" // paused (by the user or the system)
  | "reconnecting"; // stream lost while audio is wanted; recovering

// ─── Snapshot types ───
//
// Three stores by change cadence — components opt into the granularity
// they need, so a listener-count tick never re-renders the now-playing
// UI and a progress re-anchor never re-renders anything but progress.

/** "Now playing" — changes per song / program / stream / user action. */
export type PlayerSnapshot = {
  currentTrack?: Track;
  currentProgram?: Program;
  currentStream?: Stream;
  /** Static after boot (Settings' bitrate picker). */
  streamOptions?: Stream[];
  isPlaying: boolean;
  /**
   * Fine-grained transport lifecycle — `isPlaying` alone can't express
   * "reconnecting", so the UI was showing stale truth during stream
   * losses. Consumers that only care about play/pause keep reading
   * `isPlaying`.
   */
  playbackState: TransportState;
  isInitialized: boolean;
  /**
   * The listener wants playback but the audible station clock has no measured
   * stream lag yet — the first seconds after playing or reconnecting, while
   * progress/countdown still fall back to the wall clock and are known to be
   * ahead of the speaker. The header bar and countdown render a muted,
   * "calculating" state until it flips false; the media-session seek bar is
   * withheld until then.
   */
  syncing: boolean;
};

/** Poll data — changes per API poll (5s playing / 30s paused). */
export type StationSnapshot = {
  currentListeners?: Listeners;
  lastPlayedTracks?: Track[];
  lastRequestedTracks?: Track[];
};

/**
 * Progress — where the heard track is, as a fixed point the UI advances in
 * real time itself (a native bar animation, a countdown timed to each second).
 * It changes only when the position is re-placed (a title heard, the clock
 * locked, pause / resume), not while a track plays.
 */
export type ProgressSnapshot = {
  /** Elapsed ms into the heard track at {@link progressAt}; `null` while unknown. */
  progressMs: number | null;
  /** Wall clock (epoch ms) {@link progressMs} holds at. */
  progressAt: number;
  /** Audio flows: the position advances with the wall clock from {@link progressAt}. */
  progressRunning: boolean;
  showProgress: boolean;
  /**
   * The heard track's length as shown (bar, countdown): the station's, or —
   * on a live program that sends none — the one estimated from its lyrics.
   * `0` while unknown. Display only: the sync logic keeps the station's.
   */
  durationMs: number;
};

// ─── Singleton stores ───

export const playerStore = createStore<PlayerSnapshot>({
  isPlaying: false,
  playbackState: "idle",
  isInitialized: false,
  syncing: false,
});

export const stationStore = createStore<StationSnapshot>({});

export const progressStore = createStore<ProgressSnapshot>({
  progressMs: null,
  progressAt: 0,
  progressRunning: false,
  showProgress: false,
  durationMs: 0,
});
