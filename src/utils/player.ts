import TrackPlayer, { NowPlayingMetadata } from "react-native-track-player";
import { API, AnimuInfoProps, ProgramProps, TrackProps } from "../api";
import { CONFIG } from "./player.config";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { openBrowserAsync } from "expo-web-browser";
import { DICT } from "../languages";
import { SetupService } from "../services";
import { isUrlAnImage } from ".";
import { Stream } from "../core/domain/stream";
import { userSettingsService } from "../core/services/user-settings.service";

export interface MyPlayerProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
  _currentStream: Stream;
  currentProgress: number;
  _loaded: boolean;
  _paused: boolean;
  currentInformation: AnimuInfoProps | null;
  getCurrentMusic: () => Promise<AnimuInfoProps>;
  getCurrentMusicInNowPlayingMetadataFormat: () => NowPlayingMetadata;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  getProgram: () => Promise<ProgramProps>;
  openPedidosURL: () => Promise<void>;
  destroy: () => Promise<void>;
  updateMetadata: () => Promise<void>;
  getListeners: () => Promise<number>;
  getUltimas: (typeHistory: "pedidas" | "tocadas") => Promise<void>;
}

let playerInstance: MyPlayerProps | null = null;

export const myPlayer = (): MyPlayerProps => {
  if (!playerInstance) {
    playerInstance = {
      CONFIG,
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
        json.track.song =
          json.rawtitle.split(" | ")[0]?.trim() || json.rawtitle;
        json.track.anime =
          json.rawtitle.split(" | ")[1]?.trim() || "Tocando Agora";
        json.track.artist =
          json.track.song.split(" - ")[0]?.trim() || json.track.artist;
        json.track.song =
          json.track.song.split(" - ")[1]?.trim() || json.track.song;
        json.track.isRequest = json.track.rawtitle
          .toLowerCase()
          .includes("pedido");
        switch (userSettingsService.getCurrentSettings().liveQualityCover) {
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

        // Get program info
        json.program = await this.getProgram();
        if (this._currentStream.category !== "REPRISES") {
          json.program.raw = DICT["PT"].PROGRAMS.find(
            (program) =>
              program.name.toLocaleLowerCase() ===
              json.program.programa.toLocaleLowerCase()
          );
        }

        // Get listeners
        json.listeners = await this.getListeners();

        // Get last requests
        await this.getUltimas("pedidas");
        json.ultimasPedidas = this.currentInformation?.ultimasPedidas || [];

        // Get last played
        await this.getUltimas("tocadas");
        json.ultimasTocadas = this.currentInformation?.ultimasTocadas || [];

        // Update current information
        this.currentInformation = json;

        // Update progress
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
            await SetupService();
          } catch (err) {
            console.error(err);
          } finally {
            this._loaded = true;
            console.log("[PlayerService] Player loaded");
            console.log(this._loaded);
            console.log(this._paused);
            console.log("Ok");
            this._currentStream = JSON.parse(
              (await AsyncStorage.getItem("currentStream")) ||
                JSON.stringify(CONFIG.DEFAULT_STREAM_OPTION)
            );
          }
        }
        await this.getCurrentMusic();
        console.log(
          "[PlayerService] Adding track:",
          this.getCurrentMusicInNowPlayingMetadataFormat()
        );
        await TrackPlayer.reset();
        await TrackPlayer.add({
          ...this.getCurrentMusicInNowPlayingMetadataFormat(),
          id: "1",
          url: this._currentStream.url,
          userAgent: CONFIG.USER_AGENT,
        });
        if (this._paused) {
          console.log("[PlayerService] Resuming playback");
          await TrackPlayer.play();
          this._paused = false;
        }
        await this.updateMetadata();
      },
      async pause() {
        console.log("[PlayerService] Pausing playback");
        console.log(this._loaded, this._paused);
        console.log(this._loaded && !this._paused);
        if (this._loaded && !this._paused) {
          await TrackPlayer.pause();
          this._paused = true;
        }
      },
      async changeStream(stream: Stream) {
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
        return json.listeners;
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
    };
  }
  return playerInstance;
};
