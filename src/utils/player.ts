import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Sound } from "expo-av/build/Audio";
import { AnimuInfoProps, ProgramProps } from "../api";
import { API } from "../api";

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
};

export interface MyPlayerProps {
  CONFIG: typeof CONFIG;
  player: Sound | null;
  curretnBitrate: keyof typeof BITRATES | null;
  _loaded: boolean;
  _paused: boolean;
  currentMusic: AnimuInfoProps | null;
  currentProgram: ProgramProps | null;
  getCurrentMusic: () => Promise<AnimuInfoProps>;
  loadStream: (streamUrl: string, shouldPlay: boolean) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  unloadStream: () => Promise<void>;
  changeBitrate: (bitrate: keyof typeof BITRATES) => Promise<void>;
  getProgram: () => Promise<ProgramProps>;
}

export const myPlayer = (): MyPlayerProps => ({
  CONFIG,
  player: null,
  curretnBitrate: null,
  _loaded: false,
  _paused: true,
  currentMusic: null,
  currentProgram: null,
  async getCurrentMusic(): Promise<AnimuInfoProps> {
    const data: any = await fetch(API.BASE_URL);
    const json: AnimuInfoProps = await data.json();
    json.listeners += 1;
    json.track.rawtitle = json.rawtitle;
    json.track.song = json.rawtitle.split(" | ")[0]?.trim() || json.rawtitle;
    json.track.anime = json.rawtitle.split(" | ")[1]?.trim() || "Tocando Agora";
    json.track.artist =
      json.track.song.split(" - ")[0]?.trim() || json.track.artist;
    json.track.song =
      json.track.song.split(" - ")[1]?.trim() || json.track.song;
    json.track.isRequest = json.track.rawtitle.toLowerCase().includes("pedido");
    this.currentMusic = json;
    await this.getProgram();
    if (this.currentProgram) {
      json.program = this.currentProgram;
      json.track.isLiveProgram =
        json.program.locutor.toLowerCase() !== "haruka yuki";
    }
    return json;
  },
  async loadStream(streamUrl: string, shouldPlay: boolean) {
    if (this._loaded && this.player) {
      this.player.unloadAsync();
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: streamUrl },
      { shouldPlay }
    );
    this.player = sound;
    this._loaded = true;
  },
  async getProgram(): Promise<ProgramProps> {
    const data: any = await fetch(API.PROGRAM_URL);
    const json: ProgramProps = await data.json();
    this.currentProgram = json;
    return json;
  },
  async play() {
    console.log("Play");
    if (this.player && (this._loaded || this._paused)) {
      if (this._paused) {
        await this.loadStream(
          BITRATES[this.curretnBitrate || DEFAULT_BITRATE].url,
          true
        );
        this._paused = false;
      } else {
        console.log("Playing");
        this._paused = false;
        await this.player.playAsync();
      }
    } else {
      console.log("1st Loading and playing");
      await this.changeBitrate(this.curretnBitrate || DEFAULT_BITRATE);
      this._paused = false;
    }
  },
  async pause() {
    if (this.player && !this._paused) {
      await this.player.unloadAsync();
      this._paused = true;
    }
  },
  async unloadStream() {
    if (this.player && this._loaded) {
      this._loaded = false;
      await this.player.stopAsync();
      await this.player.unloadAsync();
      this.player = null;
    }
  },
  async changeBitrate(bitrate: keyof typeof BITRATES = DEFAULT_BITRATE) {
    if (!this._loaded) {
      this.curretnBitrate = bitrate;
      await this.loadStream(BITRATES[this.curretnBitrate].url, false);
      await this.play();
    } else if (this.curretnBitrate !== bitrate) {
      this.curretnBitrate = bitrate;
      await this.unloadStream();
      console.log("Changing bitrate");
      await this.loadStream(BITRATES[this.curretnBitrate].url, false);
      console.log(this._paused);
      if (!this._paused) {
        console.log("Playing after bitrate change");
        await this.play();
      }
    }
  },
});
