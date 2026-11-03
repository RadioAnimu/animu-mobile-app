import type { Track } from "@/core/domain/track";

/**
 * The item's station start (epoch ms), or `null` when it has none usable.
 * `Track` types `startTime` as always set, but an item can arrive without
 * one (or with an invalid date), and the timeline must not act on it.
 */
export function trackStartMs(track: Track | null | undefined): number | null {
  if (!track) return null;
  const startTime = track.startTime as Date | undefined;
  const start = startTime?.getTime();
  return start != null && Number.isFinite(start) ? start : null;
}
