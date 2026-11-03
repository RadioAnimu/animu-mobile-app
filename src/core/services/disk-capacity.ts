import { MB } from "@/utils/format";

/** Device-wide internal-storage figures, in bytes. */
export interface DiskCapacity {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
}

/** Largest limit the device can currently hold, in whole MB (≥ 1). */
export function maxSelectableLimitBytes(availableBytes: number): number {
  return Math.max(1, Math.floor(Math.max(0, availableBytes) / MB)) * MB;
}
