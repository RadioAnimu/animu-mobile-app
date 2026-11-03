import { useEffect } from "react";
import {
  japaneseDictionary,
  japaneseDictionaryStore,
  type JapaneseDictionarySnapshot,
} from "@/core/japanese";
import { useExternalStore } from "@/hooks/useExternalStore";

/** The offline Japanese dictionary's state (checks the disk once per session). */
export function useJapaneseDictionary(): JapaneseDictionarySnapshot {
  const snapshot = useExternalStore(japaneseDictionaryStore);
  useEffect(() => {
    void japaneseDictionary.restore();
  }, []);
  return snapshot;
}
