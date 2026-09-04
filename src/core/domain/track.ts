import type { Track } from "animu-api";

/**
 * Track type comes from the `animu-api` package — the package's mappers
 * guarantee it. Only progress math stays app-side.
 */
export type { Track, Artworks } from "animu-api";

export const getTrackProgress = (track?: Track): number | null => {
  if (!track) return null;

  // Ensure that startTime is not in the future.
  const now = Date.now();
  const start = track.startTime.getTime();
  if (start > now) return null;

  // Validate that the track duration is a positive finite number.
  if (!Number.isFinite(track.duration) || track.duration <= 0) return null;

  // Calculate elapsed time in milliseconds.
  const elapsed = now - start;

  // Guard against invalid dates (NaN) and ended tracks.
  if (!Number.isFinite(elapsed) || elapsed > track.duration) return null;

  return elapsed;
};

/**
 * Whether a track is real programming instead of station filler
 * (jingles / transitions / self-promo). Drives progress display and the
 * predictive track-end refresh.
 */
export const isRealTrack = (track?: Track | null): boolean =>
  !!track &&
  !track.anime?.toLowerCase().includes("passagem") &&
  !track.artist?.toLowerCase().includes("rádio animu") &&
  !track.anime?.toLowerCase().includes("animu");
