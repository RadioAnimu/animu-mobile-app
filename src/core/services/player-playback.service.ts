import TrackPlayer, { Event } from "react-native-track-player";
import { CONFIG } from "../../utils/player.config";
import { playerService } from "./player.service";

export async function PlaybackService(): Promise<void> {
  // Get the player instance
  const playerServiceInstance = playerService();

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.reset();
    playerServiceInstance
      .refreshData(false)
      .then(() => {
        TrackPlayer.add({
          id: "1",
          url: CONFIG.DEFAULT_STREAM_OPTION.url,
          ...playerServiceInstance.getNowPlayingMetadata(),
          userAgent: CONFIG.USER_AGENT,
        })
          .then(() => {
            TrackPlayer.play()
              .then(() => {
                playerServiceInstance._paused = false;
              })
              .catch((e) => {
                console.error(e);
              });
          })
          .catch((e) => {
            console.error(e);
          });
      })
      .catch((e) => {
        console.error(e);
      });
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause()
      .then(() => {
        playerServiceInstance._paused = true;
      })
      .catch((e) => {
        console.error(e);
      });
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.reset();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, () => {});
}
