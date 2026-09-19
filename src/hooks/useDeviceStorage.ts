import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

import {
  readDiskCapacity,
  type DiskCapacity,
} from "@/core/services/device-storage.service";

export interface DeviceStorageState {
  capacity: DiskCapacity;
  measure: () => void;
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

  const measure = useCallback(() => {
    setCapacity(readDiskCapacity());
  }, []);

  return { capacity, measure };
}
