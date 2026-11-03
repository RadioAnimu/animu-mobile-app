import { Paths } from "expo-file-system";
import type { DiskCapacity } from "@/core/services/disk-capacity";

/** Typed as numbers, but iOS answers `null` when it cannot stat the volume. */
const totalDiskSpace = (): number | null => Paths.totalDiskSpace;
const availableDiskSpace = (): number | null => Paths.availableDiskSpace;

/**
 * Reads the device's internal storage synchronously (native props, no
 * traversal). Defensive: the native getters can throw on rare platform
 * states, and the UI must still render a coherent bar.
 */
export function readDiskCapacity(): DiskCapacity {
  let totalBytes = 0;
  let availableBytes = 0;
  try {
    totalBytes = totalDiskSpace() ?? 0;
  } catch {
    totalBytes = 0;
  }
  try {
    availableBytes = availableDiskSpace() ?? 0;
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
