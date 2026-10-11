// ─── Generic external store (compatible with useSyncExternalStore) ───
//
// Core modules publish snapshots through these stores; React reads them with
// `useSyncExternalStore`. A write that changes nothing (shallow compare)
// notifies no one, so a repeated emit never re-renders a consumer.

type Listener = () => void;

export interface ExternalStore<T> {
  getSnapshot(): T;
  /** Only notifies listeners if the snapshot actually changed (shallow compare). */
  setSnapshot(next: T): void;
  subscribe(listener: Listener): () => void;
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function createStore<T extends Record<string, unknown>>(
  initialSnapshot: T,
): ExternalStore<T> {
  let snapshot = initialSnapshot;
  const listeners = new Set<Listener>();

  const notify = () => {
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot(): T {
      return snapshot;
    },

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
