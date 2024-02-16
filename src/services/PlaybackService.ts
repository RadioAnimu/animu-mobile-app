import TrackPlayer, { Event } from "react-native-track-player";
import { MyPlayerProps } from "../utils";

export async function PlaybackService(player: MyPlayerProps): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.reset();
    player
      .getCurrentMusic()
      .then(() => {
        TrackPlayer.add({
          id: "1",
          url: player.CONFIG.DEFAULT_STREAM_OPTION.url,
          ...player.getCurrentMusicInNowPlayingMetadataFormat(),
          userAgent: player.CONFIG.USER_AGENT,
        })
          .then(() => {
            TrackPlayer.play()
              .then(() => {
                player._paused = false;
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
        player._paused = true;
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
