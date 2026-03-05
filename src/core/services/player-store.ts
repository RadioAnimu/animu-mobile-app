import { Track } from "../domain/track";
import { Stream } from "../domain/stream";
import { Listeners } from "../domain/listeners";
import { Program } from "../domain/program";

// ─── Snapshot types ───

export type PlayerSnapshot = {
  currentTrack?: Track;
  lastPlayedTracks?: Track[];
  lastRequestedTracks?: Track[];
  currentProgram?: Program;
  currentStream?: Stream;
  streamOptions?: Stream[];
  currentListeners?: Listeners;
  isPlaying: boolean;
  isInitialized: boolean;
};

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
  isInitialized: false,
});

export const progressStore = createStore<ProgressSnapshot>({
  currentTrackProgress: null,
  showProgress: false,
});
