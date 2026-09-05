import { Track } from "../domain/track";
import { Stream } from "../domain/stream";
import { Listeners } from "../domain/listeners";
import { Program } from "../domain/program";
import type { TransportState } from "./transport-state";

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

    /** Shallow-merge partial updates into the current snapshot. */
    update(partial: Partial<T>): void {
      const next = { ...snapshot, ...partial } as T;
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
});

export const stationStore = createStore<StationSnapshot>({});

export const progressStore = createStore<ProgressSnapshot>({
  currentTrackProgress: null,
  showProgress: false,
});
