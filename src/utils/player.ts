import { AnimuInfoProps, ProgramProps } from "../api";
import { API } from "../api";
import TrackPlayer, { NowPlayingMetadata } from "react-native-track-player";
import { CONFIG } from "./player.config";

import { openBrowserAsync } from "expo-web-browser";
import { SetupService } from "../services";

function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
}

export interface MyPlayerProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
  _currentBitrate: keyof typeof CONFIG.BITRATES;
  currentProgress: number;
  _loaded: boolean;
  _paused: boolean;
  currentInformation: AnimuInfoProps | null;
  getCurrentMusic: () => Promise<AnimuInfoProps>;
  getCurrentMusicInNowPlayingMetadataFormat: () => NowPlayingMetadata;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeBitrate: (bitrate: keyof typeof CONFIG.BITRATES) => Promise<void>;
  getProgram: () => Promise<ProgramProps>;
  openPedidosURL: () => Promise<void>;
  destroy: () => Promise<void>;
  updateMetadata: () => Promise<void>;
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
  getCurrentMusicInNowPlayingMetadataFormat(): NowPlayingMetadata {
    return {
      artist: this.currentInformation?.track.anime,
      title: this.currentInformation?.track.artist,
      artwork: this.currentInformation?.track.artworks.cover,
      /*
      duration: this.currentInformation?.track.duration
        ? ~~(this.currentInformation?.track.duration / 1000)
        : 0,
      elapsedTime: this.currentInformation?.track.progress
        ? ~~(this.currentInformation?.track.progress / 1000)
        : 0,
      isLiveStream: false, */
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
    console.log("Executing play");
    if (!this._loaded) {
      try {
        await SetupService(this);
      } catch (error) {
        console.log(error);
      }
    }
    this._loaded = true;
    await this.getCurrentMusic();
    await TrackPlayer.reset();
    await TrackPlayer.add({
      ...this.getCurrentMusicInNowPlayingMetadataFormat(),
      id: "1",
      url: CONFIG.BITRATES[this._currentBitrate].url,
      userAgent: CONFIG.USER_AGENT,
    });
    if (this._paused) {
      await TrackPlayer.play();
      this._paused = false;
    }
    await TrackPlayer.updateNowPlayingMetadata(
      this.getCurrentMusicInNowPlayingMetadataFormat()
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
  async updateMetadata() {
    await this.player.updateNowPlayingMetadata(
      this.getCurrentMusicInNowPlayingMetadataFormat()
    );
  },
  async destroy() {
    await this.player.reset();
    this._loaded = false;
  },
});
