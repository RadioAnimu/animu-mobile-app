import { AnimuInfoProps, ProgramProps, TrackProps } from "../api";
import { API } from "../api";
import TrackPlayer, {
  Capability,
  Event,
  NowPlayingMetadata,
} from "react-native-track-player";
import { THEME } from "../theme";

import { CONFIG } from "./player.config";

import { openBrowserAsync } from "expo-web-browser";

function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
}

// Config TrackPlayer Settings Function
const configPlayer = async (player: MyPlayerProps) => {
  console.log("Setting up player");

  await player.getCurrentMusic();
  const initialObject = {
    id: "1",
    url: player.CONFIG.BITRATES[player._currentBitrate].url,
    ...(await player.getCurrentMusicInNowPlayingMetadataFormat()),
    userAgent: player.CONFIG.USER_AGENT,
  };

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.reset();
    player
      .getCurrentMusicInNowPlayingMetadataFormat()
      .then((metadata: NowPlayingMetadata) => {
        TrackPlayer.add({
          id: "1",
          url: player.CONFIG.BITRATES[player._currentBitrate].url,
          ...metadata,
          userAgent: player.CONFIG.USER_AGENT,
        }).then(() => {
          TrackPlayer.play().then(() => {
            player._paused = false;
          });
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

  // Set up the player
  await TrackPlayer.setupPlayer();

  // Add a track to the queue
  await TrackPlayer.add(initialObject);

  await TrackPlayer.updateOptions({
    capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
    compactCapabilities: [Capability.Play, Capability.Pause],
    notificationCapabilities: [Capability.Play, Capability.Pause],
    // Obviously, color property would not work if artwork is specified. It can be used as a fallback.
    color: +THEME.COLORS.BACKGROUND_800.replace("#", ""),
  });
};

export interface MyPlayerProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
  _currentBitrate: keyof typeof CONFIG.BITRATES;
  currentProgress: number;
  _loaded: boolean;
  _paused: boolean;
  currentInformation: AnimuInfoProps | null;
  getCurrentMusic: () => Promise<AnimuInfoProps>;
  getCurrentMusicInNowPlayingMetadataFormat: () => Promise<NowPlayingMetadata>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeBitrate: (bitrate: keyof typeof CONFIG.BITRATES) => Promise<void>;
  getProgram: () => Promise<ProgramProps>;
  openPedidosURL: () => Promise<void>;
  destroy: () => Promise<void>;
  // _oscilloscopeEnabled: boolean;
}

export const myPlayer = (): MyPlayerProps => ({
  CONFIG,
  player: TrackPlayer,
  _currentBitrate: CONFIG.DEFAULT_BITRATE,
  _loaded: false,
  _paused: true,
  currentInformation: null,
  currentProgress: 0,
  // _oscilloscopeEnabled: false,
  async getCurrentMusic(): Promise<AnimuInfoProps> {
    const data: any = await fetch(API.BASE_URL);
    const json: AnimuInfoProps = await data.json();
    json.track.rawtitle = json.rawtitle;
    json.track.song = json.rawtitle.split(" | ")[0]?.trim() || json.rawtitle;
    json.track.anime = json.rawtitle.split(" | ")[1]?.trim() || "Tocando Agora";
    json.track.artist =
      json.track.song.split(" - ")[0]?.trim() || json.track.artist;
    json.track.song =
      json.track.song.split(" - ")[1]?.trim() || json.track.song;
    json.track.isRequest = json.track.rawtitle.toLowerCase().includes("pedido");
    json.track.artworks.cover =
      json.track.artworks.large ||
      json.track.artworks.medium ||
      json.track.artworks.tiny ||
      CONFIG.DEFAULT_COVER;
    json.track.artworks.cover = isUrlAnImage(json.track.artworks.cover)
      ? json.track.artworks.cover
      : CONFIG.DEFAULT_COVER;
    json.program = await this.getProgram();
    this.currentInformation = json;
    if (!this.currentInformation.program?.isLiveProgram) {
      json.track.progress = Date.now() - json.track.timestart;
    }
    return json;
  },
  async getCurrentMusicInNowPlayingMetadataFormat(): Promise<NowPlayingMetadata> {
    return {
      artist: this.currentInformation?.track.anime,
      title: this.currentInformation?.track.artist,
      artwork: this.currentInformation?.track.artworks.cover,
      duration: this.currentInformation?.track.duration,
    };
  },
  async getProgram(): Promise<ProgramProps> {
    const data: any = await fetch(API.PROGRAM_URL);
    const json: ProgramProps = await data.json();
    json.isLiveProgram = json.locutor.toLowerCase().trim() !== "haruka yuki";
    if (this.currentInformation) {
      this.currentInformation.program = json;
    }
    return json;
  },
  async play() {
    if (!this._loaded) {
      try {
        await configPlayer(this);
      } catch (error) {
        console.log(error);
      }
    }
    this._loaded = true;
    await TrackPlayer.reset();
    await TrackPlayer.add({
      ...(await this.getCurrentMusicInNowPlayingMetadataFormat()),
      id: "1",
      url: CONFIG.BITRATES[this._currentBitrate].url,
      userAgent: CONFIG.USER_AGENT,
    });
    if (this._paused) {
      await TrackPlayer.play();
      this._paused = false;
    }
    await TrackPlayer.updateNowPlayingMetadata(
      await this.getCurrentMusicInNowPlayingMetadataFormat()
    );
  },
  async pause() {
    if (this._loaded && !this._paused) {
      await TrackPlayer.pause();
      this._paused = true;
    }
  },
  async changeBitrate(
    bitrate: keyof typeof CONFIG.BITRATES = CONFIG.DEFAULT_BITRATE
  ) {
    if (this._currentBitrate !== bitrate) {
      this._currentBitrate = bitrate;
      if (!this._paused) {
        this._paused = true;
        await this.play();
      }
    }
  },
  async openPedidosURL(): Promise<void> {
    await openBrowserAsync(API.PEDIDOS_URL);
  },
  async destroy() {
    await this.player.reset();
    this._loaded = false;
  },
});
