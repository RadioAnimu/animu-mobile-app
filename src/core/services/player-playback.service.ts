import TrackPlayer, { Event } from "react-native-track-player";

let updatePlayerState: ((isPlaying: boolean) => void) | null = null;
let remotePlayHandler: (() => Promise<void>) | null = null;
let remotePauseHandler: (() => Promise<void>) | null = null;

export const setPlayerStateUpdater = (
  updater: (isPlaying: boolean) => void,
) => {
  updatePlayerState = updater;
};

export const setRemotePlaybackHandlers = (handlers: {
  play: () => Promise<void>;
  pause: () => Promise<void>;
}) => {
  remotePlayHandler = handlers.play;
  remotePauseHandler = handlers.pause;
};

export async function PlaybackService() {
  console.log("[PlaybackService] Android background service initialized");

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log("[PlaybackService] Remote play requested");
    try {
      if (remotePlayHandler) {
        // Full reconnect: reset → fetch fresh data → add stream → play
        await remotePlayHandler();
      } else {
        // Fallback before handlers are wired up
        await TrackPlayer.play();
        updatePlayerState?.(true);
      }
    } catch (error) {
      console.error("[PlaybackService] Remote play error:", error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log("[PlaybackService] Remote pause requested");
    try {
      if (remotePauseHandler) {
        await remotePauseHandler();
      } else {
        await TrackPlayer.pause();
        updatePlayerState?.(false);
      }
    } catch (error) {
      console.error("[PlaybackService] Remote pause error:", error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.log("[PlaybackService] Remote stop requested");
    try {
      await TrackPlayer.reset();
      updatePlayerState?.(false);
    } catch (error) {
      console.error("[PlaybackService] Remote stop error:", error);
    }
  });
}
