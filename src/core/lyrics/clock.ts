import type { Track } from "../domain/track";

// ─── Karaoke clock ───
//
// The radio plays server-side: the station stamps when the track started
// (`track.startTime`) and everything else derives from the wall clock.
// Computing `now - start` per frame needs no ticker and never drifts —
// each frame re-anchors to the server truth instead of integrating a
// local delta.

/** Server-stamped track start as an epoch-ms primitive (NaN-safe). */
export function trackStartMs(track: Track | undefined | null): number | null {
  const start = track?.startTime?.getTime();
  if (start == null || !Number.isFinite(start)) return null;
  return start;
}

/**
 * Elapsed playback time in ms, or null when the track carries no usable
 * start stamp (clock skew, jingle rows). Unlike the progress bar's
 * helper, the result is NOT cut off at the track end — the karaoke view
 * keeps the last line highlighted until the next track arrives.
 */
export function getElapsedMs(track: Track, now: number = Date.now()): number | null {
  const start = trackStartMs(track);
  if (start == null || start > now) return null;
  return Math.max(0, now - start);
}

/** Same math, primitive form — what the rAF loops actually consume. */
export function elapsedFromStart(
  startTimeMs: number | null,
  now: number = Date.now(),
): number | null {
  if (startTimeMs == null || startTimeMs > now) return null;
  return Math.max(0, now - startTimeMs);
}
