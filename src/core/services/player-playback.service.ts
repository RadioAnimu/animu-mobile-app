import TrackPlayer, { Event } from "react-native-track-player";
import { CONFIG } from "../../utils/player.config";

// Global reference to the player service - this will be set by the main service
let playerServiceReference: any = null;

export const setPlayerServiceReference = (service: any) => {
  playerServiceReference = service;
};

export function PlaybackService() {
  console.log("[PlaybackService] Android background service initialized");

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log("[PlaybackService] Remote play requested");
    try {
      if (playerServiceReference) {
        await TrackPlayer.reset();
        await playerServiceReference.refreshData(false);

        await TrackPlayer.add({
          id: "1",
          url: playerServiceReference._currentStream.url,
          ...playerServiceReference.getNowPlayingMetadata(),
          userAgent: CONFIG.USER_AGENT,
        });

        await TrackPlayer.play();
        playerServiceReference._paused = false;
      }
    } catch (error) {
      console.error("[PlaybackService] Remote play error:", error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log("[PlaybackService] Remote pause requested");
    try {
      await TrackPlayer.pause();
      if (playerServiceReference) {
        playerServiceReference._paused = true;
      }
    } catch (error) {
      console.error("[PlaybackService] Remote pause error:", error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.log("[PlaybackService] Remote stop requested");
    try {
      await TrackPlayer.reset();
    } catch (error) {
      console.error("[PlaybackService] Remote stop error:", error);
    }
  });
}
