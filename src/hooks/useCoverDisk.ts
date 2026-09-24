import { useCallback, useSyncExternalStore } from "react";

import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { coverDiskStorage } from "@/core/services/cover-disk-storage.service";
import { formatBytes, interpolate } from "@/utils/format";

/**
 * Wipe-in-progress flag from the storage service — one store-wide signal
 * that drives the clean button, the Settings cache toggle and any device
 * bar refresh (the clean-button wipe and the automatic cache-off wipe
 * both pass through it).
 */
export function useCoverDiskClearing(): boolean {
  return useSyncExternalStore(
    (listener) => coverDiskStorage.subscribe(listener),
    () => coverDiskStorage.isClearing,
  );
}

/**
 * The freed-space toast shared by every cover-storage surface (the wipe's
 * visible payoff): "Freed {freed}".
 */
export function useFreedCoverToast(): (freedBytes: number) => void {
  const { toast } = useAlert();
  const dict = useDict();
  return useCallback(
    (freedBytes: number) => {
      toast(interpolate(dict.STORAGE_FREED, { freed: formatBytes(freedBytes) }));
    },
    [toast, dict],
  );
}
