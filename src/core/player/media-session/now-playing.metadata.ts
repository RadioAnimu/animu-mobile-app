import type { NowPlayingMetadata } from "@/core/player/ports";
import type { Track } from "@/core/domain/track";

export interface NowPlayingInput {
  track?: Track | null;
  isLive: boolean;
  /** Whether to show real progress in the media session notification. */
  showProgress: boolean;
  /**
   * The length to publish, ms: the station's, or a live program's estimate —
   * decided by the caller (the track's own `duration` is not read here).
   */
  durationMs: number;
  defaultCover: string;
}

/** Shown when there is nothing better to name (no track yet). */
const STATION_NAME = "Rádio Animu";

/**
 * The two lock-screen lines for a track. An anime song keeps the anime as
 * the title (the media session always has); a song from no anime (a J-Pop
 * single) promotes the song to the title instead of showing a placeholder,
 * and a missing artist line takes the song so nothing reads "N/A".
 */
const lockScreenLines = (track: Track | null | undefined): { title: string; artist: string } => {
  const anime = track?.anime.trim() ?? "";
  const song = track?.title.trim() ?? "";
  const artist = track?.artist.trim() ?? "";
  return {
    title: anime || song || STATION_NAME,
    artist: artist || (anime ? song : ""),
  };
};

/** Pure mapper: app state → native media-session metadata. */
export const buildNowPlayingMetadata = ({
  track,
  isLive,
  showProgress,
  durationMs,
  defaultCover,
}: NowPlayingInput): NowPlayingMetadata => {
  const baseMetadata: NowPlayingMetadata = {
    ...lockScreenLines(track),
    artwork: track?.artwork || defaultCover,
    isLiveStream: isLive,
  };

  // Show the duration so the OS can interpolate the seek bar. No progress →
  // no duration so the bar is empty/hidden.
  if (showProgress && track && durationMs > 0) {
    return { ...baseMetadata, durationSec: durationMs / 1000 };
  }

  return baseMetadata;
};
