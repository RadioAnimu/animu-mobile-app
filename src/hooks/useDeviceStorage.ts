import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

import { readDiskCapacity } from "@/core/services/device-storage.service";
import type { DiskCapacity } from "@/core/services/disk-capacity";

export interface DeviceStorageState {
  capacity: DiskCapacity;
  /** Re-reads the native getters now — the bar and the selectable limit
      tiers follow storage work (a wipe, a trim) that settled without a
      navigation, so they never wait for the next screen focus. */
  refresh: () => void;
}

/**
 * Device capacity, re-read on every screen focus so free space stays
 * honest after the user frees something elsewhere. Synchronous native
 * getters — no loading state, no directory traversal.
 */
export function useDeviceStorage(): DeviceStorageState {
  const [capacity, setCapacity] = useState<DiskCapacity>(() =>
    readDiskCapacity(),
  );

  useFocusEffect(
    useCallback(() => {
      setCapacity(readDiskCapacity());
    }, []),
  );

  const refresh = useCallback(() => setCapacity(readDiskCapacity()), []);

  return { capacity, refresh };
}
