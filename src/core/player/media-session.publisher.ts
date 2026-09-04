import type {
  NowPlayingMetadata,
  PlaybackStatus,
} from "react-native-playback-controls";
import {
  setNowPlayingMetadata,
  setRemotePlaybackStatus,
} from "../services/player-playback.service";

/**
 * Thin push facade over the native media session. Everything the app
 * shows on the lock screen / notification goes through here, which makes
 * "what do we push to the OS" trivial to stub in tests.
 */
export class MediaSessionPublisher {
  /** Pushes metadata + status (with optional position) in one go. */
  push(
    metadata: NowPlayingMetadata,
    status: PlaybackStatus,
    positionSec?: number,
  ): void {
    setNowPlayingMetadata(metadata);
    setRemotePlaybackStatus(status, positionSec);
  }

  /** Pushes only the playback status (e.g. on pause). */
  pushStatus(status: PlaybackStatus, positionSec?: number): void {
    setRemotePlaybackStatus(status, positionSec);
  }
}
