import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  coverDiskStorage,
  type CoverStorageSnapshot,
} from "@/core/services/cover-disk-storage.service";

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

  const maxBytes = settings.coverCacheLimitBytes;
  const partitions = settings.coverCachePartitionBytes;

  const measure = useCallback(async () => {
    setMeasuring(true);
    try {
      // The limit rides along the same serialized pass: an over-budget
      // partition is trimmed (oldest FIFO) before the slices are built,
      // so the card reports the POST-trim truth, never a number the user
      // has just paid to get rid of.
      const next = await coverDiskStorage.computeSnapshot(maxBytes, partitions);
      if (aliveRef.current) setSnapshot(next);
    } catch (error) {
      console.warn("[CoverStorageCard] measure failed:", error);
      if (aliveRef.current) setSnapshot(null);
    } finally {
      if (aliveRef.current) setMeasuring(false);
    }
  }, [maxBytes, partitions]);

  // Stable focus handler: the measure identity changes with the limit
  // shape, but a re-created focus effect would re-fire MOUNT while the
  // screen stays focused (double pass on every limit/partition change —
  // serialized, but a wasted full stat). The ref indirection keeps the
  // focus effect mount-only; the shape effect below owns re-measures.
  const measureRef = useRef(measure);
  useEffect(() => {
    measureRef.current = measure;
  }, [measure]);

  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      void measureRef.current();
      return () => {
        aliveRef.current = false;
      };
    }, []),
  );

  // Re-measure right after a limit or partition change (the provider's
  // trim runs in its own settings chain — measure queued behind it shows
  // the result on the card immediately, without leaving the screen).
  const lastShape = useRef(`${maxBytes}|${JSON.stringify(partitions)}`);
  useEffect(() => {
    const shape = `${maxBytes}|${JSON.stringify(partitions)}`;
    if (lastShape.current === shape) return;
    lastShape.current = shape;
    if (!settings.cacheEnabled) return;
    void measure();
  }, [maxBytes, partitions, measure, settings.cacheEnabled]);

  const lastCache = useRef(settings.cacheEnabled);
  useEffect(() => {
    if (lastCache.current === settings.cacheEnabled) return;
    lastCache.current = settings.cacheEnabled;
    void measure();
  }, [settings.cacheEnabled, measure]);

  return { snapshot, measuring, measure };
}
