import { Track } from "@/core/domain/track";
import { Stream } from "@/core/domain/stream";
import { Listeners } from "@/core/domain/listeners";
import { Program } from "@/core/domain/program";
import type { TransportState } from "@/core/player/stream-playback/transport-state";

// ─── Snapshot types ───
//
// Three stores by change cadence — components opt into the granularity
// they need, so a listener-count tick never re-renders the now-playing
// UI and a 1 Hz progress tick never re-renders anything but progress.

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

/** Progress — changes every second while a track plays. */
export type ProgressSnapshot = {
  currentTrackProgress: number | null;
  showProgress: boolean;
};

// ─── Generic external store (compatible with useSyncExternalStore) ───

type Listener = () => void;

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function createStore<T extends Record<string, unknown>>(initialSnapshot: T) {
  let snapshot = initialSnapshot;
  const listeners = new Set<Listener>();

  const notify = () => {
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot(): T {
      return snapshot;
    },

    /** Only notifies listeners if the snapshot actually changed (shallow compare). */
    setSnapshot(next: T): void {
      if (shallowEqual(snapshot, next)) return;
      snapshot = next;
      notify();
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ─── Singleton stores ───

export const playerStore = createStore<PlayerSnapshot>({
  isPlaying: false,
  playbackState: "idle",
  isInitialized: false,
  syncing: false,
});

export const stationStore = createStore<StationSnapshot>({});

export const progressStore = createStore<ProgressSnapshot>({
  currentTrackProgress: null,
  showProgress: false,
});
