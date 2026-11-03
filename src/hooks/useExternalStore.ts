import { useCallback, useSyncExternalStore } from "react";
import type { ExternalStore } from "@/core/external-store";

/**
 * Current snapshot of a core store, re-rendering when it changes. The store's
 * methods are called through stable wrappers (a new `subscribe` identity
 * would make React resubscribe on every render).
 */
export function useExternalStore<T>(store: ExternalStore<T>): T {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store],
  );
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
