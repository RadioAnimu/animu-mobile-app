import TrackPlayer, { NowPlayingMetadata } from "react-native-track-player";
import { API, AnimuInfoProps, ProgramProps } from "../api";
import { CONFIG, StreamOption } from "./player.config";

import { openBrowserAsync } from "expo-web-browser";
import { SetupService } from "../services";

function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
}

export interface MyPlayerProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
  _currentStream: StreamOption;
  currentProgress: number;
  _loaded: boolean;
  _paused: boolean;
  currentInformation: AnimuInfoProps | null;
  getCurrentMusic: () => Promise<AnimuInfoProps>;
  getCurrentMusicInNowPlayingMetadataFormat: () => NowPlayingMetadata;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: StreamOption) => Promise<void>;
  getProgram: () => Promise<ProgramProps>;
  openPedidosURL: () => Promise<void>;
  destroy: () => Promise<void>;
  updateMetadata: () => Promise<void>;
  // _oscilloscopeEnabled: boolean;
}

export const myPlayer = (): MyPlayerProps => ({
  CONFIG,
  player: TrackPlayer,
  _currentStream: CONFIG.DEFAULT_STREAM_OPTION,
  _loaded: false,
  _paused: true,
  currentInformation: null,
  currentProgress: 0,
  // _oscilloscopeEnabled: false,
  async getCurrentMusic(): Promise<AnimuInfoProps> {
    const data: any = await fetch(
      this._currentStream.category === "REPRISES"
        ? API.SAIJIKKOU_URL
        : API.BASE_URL
    );
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
      artist: this.currentInformation?.track.artist,
      title: this.currentInformation?.track.anime,
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
    const data: any = await fetch(
      this._currentStream.category === "REPRISES"
        ? API.SAIJIKKOU_URL
        : API.PROGRAM_URL
    );
    const json: ProgramProps = await data.json();
    json.isLiveProgram =
      this._currentStream.category !== "REPRISES" &&
      json.locutor.toLowerCase().trim() !== "haruka yuki";
    if (this.currentInformation) {
      this.currentInformation.program = json;
      this.currentInformation.program.isSaijikkou =
        this._currentStream.category === "REPRISES";
      this.currentInformation.program.locutor = "Haruka Yuki";
    }
    return json;
  },
  async play() {
    console.log("Executing play");
    if (!this._loaded) {
      try {
        await SetupService(this);
      } catch (err) {
        console.error(err);
      } finally {
        this._loaded = true;
      }
    }
    await this.getCurrentMusic();
    await TrackPlayer.reset();
    await TrackPlayer.add({
      ...this.getCurrentMusicInNowPlayingMetadataFormat(),
      id: "1",
      url: this._currentStream.url,
      userAgent: CONFIG.USER_AGENT,
    });
    if (this._paused) {
      await TrackPlayer.play();
      this._paused = false;
    }
    await this.updateMetadata();
  },
  async pause() {
    if (this._loaded && !this._paused) {
      await TrackPlayer.pause();
      this._paused = true;
    }
  },
  async changeStream(stream: StreamOption) {
    console.log("Changing stream to", {
      stream,
    });
    if (this._currentStream !== stream) {
      this._currentStream = stream;
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
