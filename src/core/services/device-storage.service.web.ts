import type { DiskCapacity } from "@/core/services/disk-capacity";

const UNKNOWN: DiskCapacity = { totalBytes: 0, availableBytes: 0, usedBytes: 0 };

/** The site's storage quota as the browser last reported it (its API is async). */
let estimate: DiskCapacity | null = null;

/** Asks the browser again; storage work calls it so the next read is current. */
export async function refreshDiskCapacity(): Promise<void> {
  try {
    const { quota, usage } = (await navigator.storage?.estimate?.()) ?? {};
    if (typeof quota !== "number" || typeof usage !== "number") return;
    const totalBytes = Math.max(0, quota);
    const usedBytes = Math.min(Math.max(0, usage), totalBytes);
    estimate = { totalBytes, usedBytes, availableBytes: totalBytes - usedBytes };
  } catch {
    // Keep the last figures.
  }
}
void refreshDiskCapacity();

/** Web build: the "device" is the site's storage quota, read from the last estimate. */
export function readDiskCapacity(): DiskCapacity {
  void refreshDiskCapacity();
  return estimate ?? UNKNOWN;
}

/** Free quota, unbounded until the browser has answered (a full quota then fails the write). */
export function freeQuotaBytes(): number {
  return estimate?.availableBytes ?? Number.POSITIVE_INFINITY;
}
