import TrackPlayer, { Event } from "react-native-track-player";
import { CONFIG } from "../utils/player.config";
import { MyPlayerProps } from "../utils";

export async function PlaybackService(player: MyPlayerProps): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.reset();
    TrackPlayer.add({
      id: "1",
      url: player.CONFIG.BITRATES[player._currentBitrate].url,
      ...player.getCurrentMusicInNowPlayingMetadataFormat(),
      userAgent: player.CONFIG.USER_AGENT,
    }).then(() => {
      TrackPlayer.play().then(() => {
        player._paused = false;
      });
    });
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause().then(() => {
      player._paused = true;
    });
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.reset();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, () => {});

  TrackPlayer.addEventListener(
    Event.PlaybackMetadataReceived,
    async ({ title, artist }) => {
      console.log("é para atualizar caralho");
      console.log({
        title,
        artist,
      });
      if (title && artist) {
        TrackPlayer.updateNowPlayingMetadata({
          title,
          artist,
        });
      }
    }
  );
}
