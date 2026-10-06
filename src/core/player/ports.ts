import type { Player } from "react-native-anything-player";

/**
 * The slice of react-native-anything-player's `Player` the core uses. Playback,
 * recovery (stalls, reconnects, network, live edge), audio focus,
 * interruptions, the media session and remote commands all live natively in
 * Airwave; the core only sends commands and follows its status. Tests
 * implement this with a fake.
 */
export type AudioPlayer = Pick<
  Player,
  | "status"
  | "load"
  | "play"
  | "pause"
  | "on"
  | "getProgress"
  | "updateNowPlaying"
  | "setAudioSampling"
  | "release"
>;

/** Metadata shown on the lock screen / notification / connected surfaces. */
export interface NowPlayingMetadata {
  title: string;
  artist?: string;
  artwork?: string;
  durationSec?: number;
  isLiveStream?: boolean;
}
