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
import { SetupService } from "../../services";

export interface PlayerServiceProps {
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;
  _currentStream: Stream;
  _currentTrack: Track | null;
  _currentProgram: Program | null;
  _listeners: Listeners | null;
  _loaded: boolean;
  _paused: boolean;
  currentProgress: number;
  refreshData: () => Promise<boolean>;
  getNowPlayingMetadata: () => NowPlayingMetadata;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  openPedidosURL: () => Promise<void>;
  updateMetadata: () => Promise<void>;
  destroy: () => Promise<void>;
}

let playerServiceInstance: PlayerServiceProps | null = null;

export const playerService = (): PlayerServiceProps => {
  if (!playerServiceInstance) {
    playerServiceInstance = {
      CONFIG,
      player: TrackPlayer,
      _currentStream: CONFIG.DEFAULT_STREAM_OPTION,
      _currentTrack: null,
      _currentProgram: null,
      _listeners: null,
      _loaded: false,
      _paused: true,
      currentProgress: 0,
      async refreshData() {
        console.log("[PlayerService] Updating status using animuService...");
        try {
          const [newTrack, newProgram, newListeners] = await Promise.all([
            animuService.getCurrentTrack(this._currentStream),
            animuService.getCurrentProgram(this._currentStream),
            animuService.getCurrentListeners(this._currentStream),
          ]);

          let hasChanges = false;

          if (this._currentTrack?.raw !== newTrack.raw) {
            this._currentTrack = newTrack;
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

          if (hasChanges) {
            console.log(
              "[PlayerService] Status updated: data changes detected"
            );
            if (this._loaded) {
              await this.updateMetadata();
            }
            return true;
          } else {
            console.log("[PlayerService] Status checked: no changes detected");
            return false;
          }
        } catch (error) {
          console.error("[PlayerService] Error updating status:", error);
          return false;
        }
      },
      getNowPlayingMetadata() {
        return (
          this._currentTrack?.metadata || {
            title: "N/A",
            artist: "N/A",
            album: "N/A",
            date: "N/A",
            genre: "N/A",
            description: "N/A",
            duration: 0,
            artwork: CONFIG.DEFAULT_COVER,
          }
        );
      },
      async play() {
        console.log("[PlayerService] Play requested.");
        if (!this._loaded) {
          try {
            console.log("[PlayerService] Initializing player...");
            console.log("[PlayerService] Setting up player service...");
            SetupService();
          } catch (err) {
            console.error("[PlayerService] Player setup error:", err);
          } finally {
            this._loaded = true;
            const storedStream = await AsyncStorage.getItem("currentStream");
            this._currentStream = storedStream
              ? JSON.parse(storedStream)
              : CONFIG.DEFAULT_STREAM_OPTION;
          }
        }
        await this.refreshData(); // Fetch current track, program and listeners, update the objects, and update metadata.
        await TrackPlayer.reset();
        await TrackPlayer.add({
          ...this.getNowPlayingMetadata(),
          id: "1",
          url: this._currentStream.url,
          userAgent: CONFIG.USER_AGENT,
        });
        if (this._paused) {
          console.log("[PlayerService] Starting playback.");
          await TrackPlayer.play();
          this._paused = false;
        }
        await this.updateMetadata();
      },
      async pause() {
        console.log("[PlayerService] Pause requested.");
        if (this._loaded && !this._paused) {
          await TrackPlayer.pause();
          this._paused = true;
          console.log("[PlayerService] Playback paused.");
        } else {
          console.log(
            "[PlayerService] Pause skipped (already paused or not loaded)."
          );
        }
      },
      async changeStream(stream: Stream) {
        if (this._currentStream.id !== stream.id) {
          console.log(
            `[PlayerService] Changing stream from ${this._currentStream.id} to ${stream.id}.`
          );
          this._currentStream = stream;
          await AsyncStorage.setItem("currentStream", JSON.stringify(stream));
          if (!this._paused) {
            console.log(
              "[PlayerService] Restarting playback after stream change."
            );
            await this.play();
          }
        } else {
          console.log(
            "[PlayerService] Stream change ignored (stream is identical)."
          );
        }
      },
      async openPedidosURL() {
        console.log("[PlayerService] Opening pedidos URL.");
        await openBrowserAsync(API.PEDIDOS_URL);
      },
      async updateMetadata() {
        console.log("[PlayerService] Checking metadata update...");
        const newMetadata = this.getNowPlayingMetadata();
        const currentMetadata = await this.player.getActiveTrack();

        if (
          !currentMetadata ||
          currentMetadata.title !== newMetadata.title ||
          currentMetadata.artist !== newMetadata.artist
        ) {
          console.log("[PlayerService] Updating Now Playing metadata.");
          await this.player.updateNowPlayingMetadata(newMetadata);
        } else {
          console.log("[PlayerService] Metadata unchanged, skipping update.");
        }
      },
      async destroy() {
        console.log("[PlayerService] Destroying player instance.");
        await this.player.reset();
        this._loaded = false;
      },
    };
  }
  return playerServiceInstance;
};
