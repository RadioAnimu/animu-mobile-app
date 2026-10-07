import { useEffect, useSyncExternalStore } from "react";
import {
  japaneseDictionary,
  japaneseDictionaryStore,
  type JapaneseDictionarySnapshot,
} from "@/core/japanese";

/** The offline Japanese dictionary's state (checks the disk once per session). */
export function useJapaneseDictionary(): JapaneseDictionarySnapshot {
  const snapshot = useSyncExternalStore(
    japaneseDictionaryStore.subscribe,
    japaneseDictionaryStore.getSnapshot,
  );
  useEffect(() => {
    void japaneseDictionary.restore();
  }, []);
  return snapshot;
}
