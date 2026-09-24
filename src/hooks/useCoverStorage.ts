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
export interface CoverStorageOptions {
  /**
   * Fired when a settings-driven re-measure (limit/partition change, or the
   * cache toggle) reclaims disk space. Never fired for the routine focus
   * re-measure — navigation alone must not toast.
   */
  onFreed?: (freedBytes: number) => void;
}

export function useCoverStorageSnapshot(
  options?: CoverStorageOptions,
): {
  snapshot: CoverStorageSnapshot | null;
  measuring: boolean;
  measure: () => Promise<CoverStorageSnapshot | null>;
} {
  const { settings } = useUserSettings();
  const [snapshot, setSnapshot] = useState<CoverStorageSnapshot | null>(null);
  const [measuring, setMeasuring] = useState(true);
  /** Unmount guard — the async measure must not touch a dead component. */
  const aliveRef = useRef(true);
  /** Last settled total — the "before" side of freed-space feedback. */
  const lastTotalRef = useRef(0);
  const onFreedRef = useRef(options?.onFreed);
  useEffect(() => {
    onFreedRef.current = options?.onFreed;
  });

  const maxBytes = settings.coverCacheLimitBytes;
  const partitions = settings.coverCachePartitionBytes;

  const measure = useCallback(async () => {
    // A drawer screen stays MOUNTED across navigations, so a blurred
    // instance's shape/cache effects still fire while the user changes
    // settings on the other screen. Letting that instance measure leaves
    // it STUCK (the alive guard skips the snapshot commit but not the
    // in-flight `measuring`) and fires its freed toast for work the
    // focused screen already reported. The focus re-measure on return
    // owns the blurred screen's numbers.
    if (!aliveRef.current) return null;
    setMeasuring(true);
    try {
      // The limit rides along the same serialized pass: an over-budget
      // partition is trimmed (oldest FIFO) before the slices are built,
      // so the card reports the POST-trim truth, never a number the user
      // has just paid to get rid of.
      const next = await coverDiskStorage.computeSnapshot(maxBytes, partitions);
      lastTotalRef.current = next.totalBytes;
      if (aliveRef.current) setSnapshot(next);
      return next;
    } catch (error) {
      console.warn("[useCoverStorage] measure failed:", error);
      if (aliveRef.current) setSnapshot(null);
      return null;
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
  // A shrink against the last settled total is the user's reclaim — the
  // freed amount rides back to the screen through `onFreed`. A skipped
  // (blurred) or failed measure returns no snapshot — never a freed claim.
  const lastShape = useRef(`${maxBytes}|${JSON.stringify(partitions)}`);
  useEffect(() => {
    const shape = `${maxBytes}|${JSON.stringify(partitions)}`;
    if (lastShape.current === shape) return;
    lastShape.current = shape;
    if (!settings.cacheEnabled) return;
    const before = lastTotalRef.current;
    void measure().then((next) => {
      if (before > 0 && next) {
        const freed = before - next.totalBytes;
        if (freed > 0) onFreedRef.current?.(freed);
      }
    });
  }, [maxBytes, partitions, measure, settings.cacheEnabled]);

  const lastCache = useRef(settings.cacheEnabled);
  useEffect(() => {
    if (lastCache.current === settings.cacheEnabled) return;
    lastCache.current = settings.cacheEnabled;
    const before = lastTotalRef.current;
    void measure().then((next) => {
      if (before > 0 && next) {
        const freed = before - next.totalBytes;
        if (freed > 0) onFreedRef.current?.(freed);
      }
    });
  }, [settings.cacheEnabled, measure]);

  return { snapshot, measuring, measure };
}
