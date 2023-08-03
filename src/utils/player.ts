import { AnimuInfoProps, ProgramProps } from "../api";
import { API } from "../api";
import TrackPlayer, {
  Capability,
  Event,
  NowPlayingMetadata,
} from "react-native-track-player";
import { THEME } from "../theme";
import { VolumeManager } from "react-native-volume-manager";

const DEFAULT_COVER =
  "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

const BITRATES = {
  320: {
    category: "MP3",
    kbps: 320,
    url: "https://cast.animu.com.br:9079/stream",
  },
  192: {
    category: "MP3",
    kbps: 192,
    url: "https://cast.animu.com.br:9089/stream",
  },
  64: {
    category: "AAC+",
    kbps: 64,
    url: "https://cast.animu.com.br:9069/stream",
  },
};

const DEFAULT_BITRATE: keyof typeof BITRATES = 320;

const CONFIG = {
  BITRATES,
  DEFAULT_BITRATE,
  DEFAULT_COVER,
};

const initialObject = {
  title: "",
  artist: "",
  artwork: DEFAULT_COVER,
  url: BITRATES[DEFAULT_BITRATE].url,
  duration: 0,
  id: "1",
};

function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
}

// Config TrackPlayer Settings Function
const configPlayer = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.reset();
    TrackPlayer.add(initialObject).then(() => {
      TrackPlayer.play();
    });
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
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
  currentBitrate: keyof typeof BITRATES | null;
  _loaded: boolean;
  _paused: boolean;
  _volume: number;
  currentMusic: AnimuInfoProps | null;
  currentProgram: ProgramProps | null;
  getCurrentMusic: () => Promise<AnimuInfoProps>;
  getCurrentMusicInNowPlayingMetadataFormat: () => Promise<NowPlayingMetadata>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeBitrate: (bitrate: keyof typeof BITRATES) => Promise<void>;
  getProgram: () => Promise<ProgramProps>;
}

export const myPlayer = (): MyPlayerProps => ({
  CONFIG,
  player: TrackPlayer,
  currentBitrate: null,
  _loaded: false,
  _paused: true,
  currentMusic: null,
  currentProgram: null,
  _volume: 0,
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
      DEFAULT_COVER;
    json.track.artworks.cover = isUrlAnImage(json.track.artworks.cover)
      ? json.track.artworks.cover
      : DEFAULT_COVER;
    this.currentMusic = json;
    await this.getProgram();
    if (this.currentProgram) {
      json.program = this.currentProgram;
      json.program.isLiveProgram =
        json.program.locutor.toLowerCase() !== "haruka yuki";
    }
    return json;
  },
  async getCurrentMusicInNowPlayingMetadataFormat(): Promise<NowPlayingMetadata> {
    const currentMusic = await this.getCurrentMusic();
    return {
      title: currentMusic.track.anime,
      artist: currentMusic.track.artist,
      artwork: currentMusic.track.artworks.cover,
      duration: currentMusic.track.duration,
    };
  },
  async getProgram(): Promise<ProgramProps> {
    const data: any = await fetch(API.PROGRAM_URL);
    const json: ProgramProps = await data.json();
    this.currentProgram = json;
    return json;
  },
  async play() {
    if (!this._loaded) {
      await configPlayer();
      this.currentBitrate = DEFAULT_BITRATE;
      await TrackPlayer.play();
      this._loaded = true;
    } else {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        ...((await this.getCurrentMusicInNowPlayingMetadataFormat()) as typeof initialObject),
        id: "1",
        url: BITRATES[this.currentBitrate || DEFAULT_BITRATE].url,
      });
      await TrackPlayer.play();
    }
    this._paused = false;
    this._volume = (await VolumeManager.getVolume()).volume;
  },
  async pause() {
    if (this._loaded && !this._paused) {
      await TrackPlayer.pause();
      this._paused = true;
    }
  },
  async changeBitrate(bitrate: keyof typeof BITRATES = DEFAULT_BITRATE) {
    if (this.currentBitrate !== bitrate) {
      this.currentBitrate = bitrate;
      if (!this._paused) {
        await this.play();
      }
    }
  },
});
