import { HistoryType } from "./../../@types/history-type.d";
import TrackPlayer, { NowPlayingMetadata } from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openBrowserAsync } from "expo-web-browser";
import { Stream } from "../domain/stream";
import { Track } from "../domain/track";
import { Program } from "../domain/program";
import { Listeners } from "../domain/listeners";
import { animuService } from "../services/animu.service";
import { CONFIG } from "../../utils/player.config";
import { API } from "../../api";
import { userSettingsService } from "./user-settings.service";
import { SetupService } from "./player-setup.service";

export interface PlayerServiceProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
  _currentStream: Stream;
  _currentTrack: Track | null;
  _currentProgram: Program | null;
  _lastRequestedTracks: Track[] | null;
  _lastPlayedTracks: Track[] | null;
  _listeners: Listeners | null;
  _loaded: boolean;
  _paused: boolean;
  currentProgress: number;
  refreshData: (isToUpdateMetadata?: boolean) => Promise<boolean>;
  getNowPlayingMetadata: () => NowPlayingMetadata;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  openPedidosURL: () => Promise<void>;
  updateMetadata: () => Promise<void>;
  destroy: () => Promise<void>;
  refreshHistory: (type: HistoryType) => Promise<void>;
}

let playerServiceInstance: PlayerServiceProps | null = null;

export const playerService = (): PlayerServiceProps => {
  if (!playerServiceInstance) {
    playerServiceInstance = {
      CONFIG,
      player: TrackPlayer,
      _currentStream: CONFIG.DEFAULT_STREAM_OPTION,
      _currentTrack: null,
      _lastPlayedTracks: null,
      _lastRequestedTracks: null,
      _currentProgram: null,
      _listeners: null,
      _loaded: false,
      _paused: true,
      currentProgress: 0,

      async refreshData(isToUpdateMetadata = true): Promise<boolean> {
        try {
          await userSettingsService.initialize();

          const [newTrack, newProgram, newListeners, newLastRequestedTracks] =
            await Promise.all([
              animuService.getCurrentTrack(
                this._currentStream,
                userSettingsService.getCurrentSettings().liveQualityCover
              ),
              animuService.getCurrentProgram(this._currentStream),
              animuService.getCurrentListeners(this._currentStream),
              animuService.getTrackHistory("requests"),
            ]);

          let hasChanges = false;

          if (
            this._currentTrack?.raw !== newTrack.raw ||
            this._currentTrack?.artwork !== newTrack.artwork
          ) {
            this._currentTrack = newTrack;
            this.refreshHistory("played");
            hasChanges = true;
          }

          if (this._currentProgram?.raw !== newProgram.raw) {
            this._currentProgram = newProgram;
            hasChanges = true;
          }

          if (this._listeners?.value !== newListeners.value) {
            this._listeners = newListeners;
            hasChanges = true;
          }

          if (
            newLastRequestedTracks.length > 0 &&
            newLastRequestedTracks[0].raw !==
              (this._lastRequestedTracks?.[0]?.raw || "")
          ) {
            this._lastRequestedTracks = newLastRequestedTracks;
            hasChanges = true;
          }

          if (hasChanges && this._loaded && isToUpdateMetadata) {
            await this.updateMetadata();
          }

          return hasChanges;
        } catch (error) {
          console.error("[PlayerService] Error refreshing data:", error);
          console.error(
            "[PlayerService] Error stack:",
            error instanceof Error ? error.stack : "No stack trace"
          );
          return false;
        }
      },

      getNowPlayingMetadata(): NowPlayingMetadata {
        const baseMetadata = this._currentTrack?.metadata || {
          title: "N/A",
          artist: "N/A",
          album: "N/A",
          date: "N/A",
          genre: "N/A",
          description: "N/A",
          duration: 0,
          artwork: CONFIG.DEFAULT_COVER,
        };

        return {
          ...baseMetadata,
          duration: baseMetadata.duration ? baseMetadata.duration / 1000 : 0,
          elapsedTime: this.currentProgress / 1000,
        };
      },

      async play(): Promise<void> {
        if (!this._loaded) {
          try {
            await SetupService();
            this._loaded = true;

            const storedStream = await AsyncStorage.getItem("currentStream");
            this._currentStream = storedStream
              ? JSON.parse(storedStream)
              : CONFIG.DEFAULT_STREAM_OPTION;
          } catch (err) {
            console.error("[PlayerService] Setup error:", err);
            throw err;
          }
        }

        try {
          await TrackPlayer.reset();
          this._paused = true;
          await this.refreshData(false);

          await TrackPlayer.add({
            id: "1",
            url: this._currentStream.url,
            userAgent: CONFIG.USER_AGENT,
            ...this.getNowPlayingMetadata(),
          });

          await TrackPlayer.play();
          this._paused = false;
          await this.updateMetadata();
        } catch (error) {
          console.error("[PlayerService] Playback error:", error);
          throw error;
        }
      },

      async pause(): Promise<void> {
        if (this._loaded && !this._paused) {
          try {
            await TrackPlayer.pause();
            this._paused = true;
          } catch (error) {
            console.error("[PlayerService] Pause error:", error);
          }
        }
      },

      async changeStream(stream: Stream): Promise<void> {
        if (this._currentStream.id !== stream.id) {
          const wasPlaying = !this._paused;

          if (wasPlaying) {
            await this.pause();
          }

          this._currentStream = stream;
          await AsyncStorage.setItem("currentStream", JSON.stringify(stream));

          if (wasPlaying) {
            await this.play();
          }
        }
      },

      async openPedidosURL(): Promise<void> {
        await openBrowserAsync(API.PEDIDOS_URL);
      },

      async updateMetadata(): Promise<void> {
        try {
          const newMetadata = this.getNowPlayingMetadata();
          const currentMetadata = await this.player.getActiveTrack();

          if (
            !currentMetadata ||
            currentMetadata.title !== newMetadata.title ||
            currentMetadata.artist !== newMetadata.artist
          ) {
            await this.player.updateNowPlayingMetadata(newMetadata);
          }
        } catch (error) {
          console.error("[PlayerService] Metadata update error:", error);
        }
      },

      async refreshHistory(typeHistory: HistoryType): Promise<void> {
        if (!this._lastRequestedTracks) {
          this._lastRequestedTracks = [];
        }
        if (!this._lastPlayedTracks) {
          this._lastPlayedTracks = [];
        }

        try {
          const tracks = await animuService.getTrackHistory(typeHistory);
          const targetArray =
            typeHistory === "requests"
              ? this._lastRequestedTracks
              : this._lastPlayedTracks;

          for (const track of tracks) {
            if (!targetArray.find((t) => t.raw === track.raw)) {
              targetArray.unshift(track);
            } else if (
              Date.now() - track.startTime.getTime() >
              24 * 60 * 60 * 1000
            ) {
              break;
            }
          }
        } catch (error) {
          console.error(
            `[PlayerService] Error refreshing ${typeHistory} history:`,
            error
          );
        }
      },

      async destroy(): Promise<void> {
        if (!this._loaded) {
          return;
        }

        try {
          await this.player.stop();
          await this.player.reset();

          this._loaded = false;
          this._paused = true;
          this._currentStream = CONFIG.DEFAULT_STREAM_OPTION;
          this._currentTrack = null;
          this._currentProgram = null;
          this._listeners = null;
          this.currentProgress = 0;

          playerServiceInstance = null;
        } catch (error) {
          console.error("[PlayerService] Destruction failed:", error);
        }
      },
    };
  }

  return playerServiceInstance;
};
