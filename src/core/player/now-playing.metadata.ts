import type { NowPlayingMetadata } from "react-native-playback-controls";
import type { Track } from "../domain/track";

export interface NowPlayingInput {
  track?: Track | null;
  isLive: boolean;
  /** Whether to show real progress in the media session notification. */
  showProgress: boolean;
  defaultCover: string;
}

/**
 * Pure mapper: app state → native media-session metadata.
 * (The media session has always shown the anime as the title — keep it.)
 */
export const buildNowPlayingMetadata = ({
  track,
  isLive,
  showProgress,
  defaultCover,
}: NowPlayingInput): NowPlayingMetadata => {
  const baseMetadata: NowPlayingMetadata = track
    ? {
        title: track.anime || "N/A",
        artist: track.artist || "N/A",
        artwork: track.artwork || defaultCover,
        isLiveStream: isLive,
      }
    : {
        title: "N/A",
        artist: "N/A",
        artwork: defaultCover,
        isLiveStream: isLive,
      };

  // Show REAL duration from the track data so the OS can interpolate the
  // seek bar. No progress → no duration so the bar is empty/hidden.
  if (showProgress && track && track.duration > 0) {
    return { ...baseMetadata, durationSec: track.duration / 1000 };
  }

  return baseMetadata;
};
