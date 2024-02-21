import TrackPlayer, { NowPlayingMetadata } from "react-native-track-player";
import { API, AnimuInfoProps, ProgramProps, TrackProps } from "../api";
import { UserSettings } from "./../contexts/user.settings.context";
import { CONFIG, StreamOption } from "./player.config";

import { openBrowserAsync } from "expo-web-browser";
import { DICT } from "../languages";
import { SetupService } from "../services";
import { getUserSettingsFromLocalStorage } from "../screens/Home";
import AsyncStorage from "@react-native-async-storage/async-storage";

function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
}

export interface MyPlayerProps {
  CONFIG: typeof CONFIG;
  firstTime: boolean;
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
  getListeners: () => Promise<number>;
  getUltimas: (typeHistory: "pedidas" | "tocadas") => Promise<void>;
}

export const myPlayer = (): MyPlayerProps => ({
  CONFIG,
  firstTime: true,
  player: TrackPlayer,
  _currentStream: CONFIG.DEFAULT_STREAM_OPTION,
  _loaded: false,
  _paused: true,
  currentInformation: null,
  currentProgress: 0,
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
    const userSettings = await getUserSettingsFromLocalStorage();
    switch (userSettings.liveQualityCover) {
      case "high":
        json.track.artworks.cover =
          json.track.artworks.large ||
          json.track.artworks.medium ||
          json.track.artworks.tiny ||
          CONFIG.DEFAULT_COVER;
        break;
      case "medium":
        json.track.artworks.cover =
          json.track.artworks.medium ||
          json.track.artworks.tiny ||
          CONFIG.DEFAULT_COVER;
        break;
      case "low":
        json.track.artworks.cover =
          json.track.artworks.tiny || CONFIG.DEFAULT_COVER;
        break;
      default:
        json.track.artworks.cover = CONFIG.DEFAULT_COVER;
        break;
    }
    json.track.artworks.cover = isUrlAnImage(json.track.artworks.cover)
      ? json.track.artworks.cover
      : CONFIG.DEFAULT_COVER;
    json.program = await this.getProgram();
    if (this._currentStream.category !== "REPRISES") {
      json.program.raw = DICT["PT"].PROGRAMS.find(
        (program) =>
          program.name.toLocaleLowerCase() ===
          json.program.programa.toLocaleLowerCase()
      );
    }
    json.listeners = await this.getListeners();
    await this.getUltimas("pedidas");
    json.ultimasPedidas = this.currentInformation?.ultimasPedidas || [];
    await this.getUltimas("tocadas");
    json.ultimasTocadas = this.currentInformation?.ultimasTocadas || [];
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
    json.isSaijikkou = this._currentStream.category === "REPRISES";
    json.locutor = json.isLiveProgram ? json.locutor : "Haruka Yuki";
    if (this.currentInformation) {
      this.currentInformation.program = json;
    }
    return json;
  },
  async play() {
    if (!this._loaded) {
      try {
        await SetupService(this);
      } catch (err) {
        console.error(err);
      } finally {
        this._loaded = true;
        this._currentStream = JSON.parse(
          (await AsyncStorage.getItem("currentStream")) ||
            JSON.stringify(CONFIG.DEFAULT_STREAM_OPTION)
        );
        this._paused = (await AsyncStorage.getItem("isPaused"))
          ? (await AsyncStorage.getItem("isPaused")) === "true"
          : false;
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
    if (
      (this._paused && !this.firstTime) ||
      (this.firstTime && !this._paused)
    ) {
      await TrackPlayer.play();
      this._paused = false;
      await AsyncStorage.setItem("isPaused", "false");
    }
    this.firstTime = false;
    await this.updateMetadata();
  },
  async pause() {
    if (this._loaded && !this._paused) {
      await TrackPlayer.pause();
      this._paused = true;
      await AsyncStorage.setItem("isPaused", "true");
    }
  },
  async changeStream(stream: StreamOption) {
    if (this._currentStream !== stream) {
      this._currentStream = stream;
      if (!this._paused) {
        this._paused = true;
        await this.play();
      }
      await AsyncStorage.setItem("currentStream", JSON.stringify(stream));
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
  async getListeners() {
    const data: any = await fetch(API.SAIJIKKOU_URL);
    const json: any = await data.json();
    return json.listeners + 1; // +1 to count the current listener
  },
  async getUltimas(typeHistory: "pedidas" | "tocadas") {
    const res: TrackProps[] = [];
    if (
      this.currentInformation &&
      this.currentInformation.ultimasPedidas === undefined
    ) {
      this.currentInformation.ultimasPedidas = res;
    }
    if (
      this.currentInformation &&
      this.currentInformation.ultimasTocadas === undefined
    ) {
      this.currentInformation.ultimasTocadas = res;
    }

    const data: any = await fetch(
      typeHistory === "pedidas"
        ? API.ULTIMAS_PEDIDAS_URL
        : API.ULTIMAS_TOCADAS_URL
    );
    const json: any = await data.json();

    json.forEach((item: any) => {
      const rawtitle = item[0];
      const [song, anime] = rawtitle.split(" | ");
      const isTypePedidas = typeHistory === "pedidas";
      const cover = isTypePedidas ? item[3] : item[1];
      if (rawtitle.length && !rawtitle.toLowerCase().includes("animu")) {
        res.push({
          rawtitle,
          song,
          anime,
          artist: "",
          artworks: {
            cover,
          },
          timestart:
            typeHistory === "pedidas"
              ? new Date(
                  new Date().toDateString() + " " + item[1] + ":00"
                ).getTime()
              : new Date().getTime(),
          duration: 0,
          isRequest: true,
          progress: 0,
          id: isTypePedidas ? item[2] : -1,
        });
      }
    });
    switch (typeHistory) {
      case "pedidas":
        if (
          this.currentInformation &&
          (this.currentInformation.ultimasPedidas === undefined ||
            this.currentInformation.ultimasPedidas.length === 0)
        ) {
          this.currentInformation.ultimasPedidas = res;
        } else {
          for (const track of res) {
            if (
              !this.currentInformation?.ultimasPedidas.find(
                (t) => t.rawtitle === track.rawtitle
              )
            ) {
              this.currentInformation?.ultimasPedidas.unshift(track);
            } else if (Date.now() - track.timestart > 24 * 60 * 60 * 1000) {
              break;
            }
          }
        }
        break;
      case "tocadas":
        if (
          this.currentInformation &&
          (this.currentInformation.ultimasTocadas === undefined ||
            this.currentInformation.ultimasTocadas.length === 0)
        ) {
          this.currentInformation.ultimasTocadas = res;
        } else {
          for (const track of res) {
            if (
              !this.currentInformation?.ultimasTocadas.find(
                (t) => t.rawtitle === track.rawtitle
              )
            ) {
              this.currentInformation?.ultimasTocadas.unshift(track);
            } else if (Date.now() - track.timestart > 24 * 60 * 60 * 1000) {
              break;
            }
          }
        }
        break;
    }
  },
});
