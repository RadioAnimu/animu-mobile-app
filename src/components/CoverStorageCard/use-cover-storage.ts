import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  coverDiskStorage,
  type CoverStorageSnapshot,
} from "../../core/services/cover-disk-storage.service";

/**
 * Liveness + measurement for the storage card. Owns the unmount guard
 * (the async measure must not touch a dead component), the re-measure on
 * every screen focus (the stack keeps the screen mounted across
 * navigations, and files evolve underneath while covers get tagged in
 * `Cover` during browsing), and the immediate re-measure when the cache
 * setting flips (the provider's wipe on disable runs while this screen
 * is focused — focus alone would leave the stale totals until the next
 * navigation).
 */
export function useCoverStorageSnapshot(): {
  snapshot: CoverStorageSnapshot | null;
  measuring: boolean;
  measure: () => Promise<void>;
} {
  const { settings } = useUserSettings();
  const [snapshot, setSnapshot] = useState<CoverStorageSnapshot | null>(null);
  const [measuring, setMeasuring] = useState(true);
  /** Unmount guard — the async measure must not touch a dead component. */
  const aliveRef = useRef(true);

  const measure = useCallback(async () => {
    setMeasuring(true);
    try {
      const next = await coverDiskStorage.computeSnapshot();
      if (aliveRef.current) setSnapshot(next);
    } catch (error) {
      console.warn("[CoverStorageCard] measure failed:", error);
      if (aliveRef.current) setSnapshot(null);
    } finally {
      if (aliveRef.current) setMeasuring(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      void measure();
      return () => {
        aliveRef.current = false;
      };
    }, [measure]),
  );

  const lastCache = useRef(settings.cacheEnabled);
  useEffect(() => {
    if (lastCache.current === settings.cacheEnabled) return;
    lastCache.current = settings.cacheEnabled;
    void measure();
  }, [settings.cacheEnabled, measure]);

  return { snapshot, measuring, measure };
}
