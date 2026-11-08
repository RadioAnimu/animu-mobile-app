import type { Stream } from "@/core/domain/stream";
import type { PlayerSnapshot } from "@/core/player";

/** What a stream picker marks. */
export interface ShownQuality {
  /** The stream marked: the pick, or under automatic quality the one heard. */
  stream: Stream | undefined;
  /**
   * A picked stream is not heard yet: RNAP is lining the switch up (up to
   * 30 s), or retrying one whose connection failed (after a minute).
   */
  switching: boolean;
}

/**
 * The pickers mark the listener's pick, and say while it is still on its
 * way. Under automatic quality they mark what RNAP plays (before any load,
 * the stream it opens at).
 */
export function shownQuality(
  player: Pick<PlayerSnapshot, "autoQuality" | "currentStream" | "playingStream" | "isPlaying">,
): ShownQuality {
  const { autoQuality, currentStream, playingStream, isPlaying } = player;
  if (autoQuality) return { stream: playingStream ?? currentStream, switching: false };
  const switching =
    isPlaying && currentStream != null && playingStream != null && playingStream.id !== currentStream.id;
  return { stream: currentStream, switching };
}
