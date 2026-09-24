import { Paths } from "expo-file-system";
import { MB } from "@/utils/format";

/** Device-wide internal-storage figures, in bytes. */
export interface DiskCapacity {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
}

/**
 * Reads the device's internal storage synchronously (native props, no
 * traversal). Defensive: the native getters can throw on rare platform
 * states, and the UI must still render a coherent bar.
 */
export function readDiskCapacity(): DiskCapacity {
  let totalBytes = 0;
  let availableBytes = 0;
  try {
    totalBytes = Paths.totalDiskSpace ?? 0;
  } catch {
    totalBytes = 0;
  }
  try {
    availableBytes = Paths.availableDiskSpace ?? 0;
  } catch {
    availableBytes = 0;
  }
  totalBytes = Math.max(0, totalBytes);
  availableBytes = Math.max(0, Math.min(availableBytes, totalBytes || availableBytes));
  return {
    totalBytes,
    availableBytes,
    usedBytes: Math.max(0, totalBytes - availableBytes),
  };
}

/** Largest limit the device can currently hold, in whole MB (≥ 1). */
export function maxSelectableLimitBytes(availableBytes: number): number {
  return Math.max(1, Math.floor(Math.max(0, availableBytes) / MB)) * MB;
}
