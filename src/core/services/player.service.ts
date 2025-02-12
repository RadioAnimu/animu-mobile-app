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
import { Platform } from "react-native";
import { SetupService } from "./player-setup.service";

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
  refreshData: (isToUpdateMetadata?: boolean) => Promise<boolean>;
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
      async refreshData(isToUpdateMetadata = true) {
        console.log("[PlayerService] Updating status using animuService...");
        try {
          await userSettingsService.initialize();
          const [newTrack, newProgram, newListeners] = await Promise.all([
            animuService.getCurrentTrack(
              this._currentStream,
              userSettingsService.getCurrentSettings().liveQualityCover
            ),
            animuService.getCurrentProgram(this._currentStream),
            animuService.getCurrentListeners(this._currentStream),
          ]);

          let hasChanges = false;

          if (
            this._currentTrack?.raw !== newTrack.raw ||
            this._currentTrack?.artwork !== newTrack.artwork
          ) {
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
            if (this._loaded && isToUpdateMetadata) {
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

        // Force stop any existing playback
        await TrackPlayer.reset();
        this._paused = true;

        await this.refreshData(false);

        await TrackPlayer.add({
          ...this.getNowPlayingMetadata(),
          id: "1",
          url: this._currentStream.url,
          userAgent: CONFIG.USER_AGENT,
        });

        console.log("[PlayerService] Starting playback.");
        await TrackPlayer.play();
        this._paused = false;

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

          // Store previous playback state
          const wasPlaying = !this._paused;

          // Stop current playback immediately
          if (wasPlaying) {
            await this.pause();
          }

          // Update the stream
          this._currentStream = stream;
          await AsyncStorage.setItem("currentStream", JSON.stringify(stream));

          // Restart playback if it was playing
          if (wasPlaying) {
            console.log("[PlayerService] Restarting playback with new stream");
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
        console.log("[PlayerService] Nuclear destruction sequence initiated.");
        if (!this._loaded) {
          console.log("[PlayerService] Player instance not loaded.");
          return;
        }
        try {
          // 1. Stop any ongoing playback
          await this.player.stop();

          // 2. Reset all player components
          await this.player.reset();

          // 3. Remove all event listeners (critical for Android background services)
          // this.player.removeAllListeners();

          // 4. Actually destroy the player instance (Android specific but harmless on iOS)
          // await this.player.destroy();

          // 5. Clean up any remaining native resources
          // if (Platform.OS === "android") {
          //   await this.player.unregisterPlaybackService();
          // }

          // 6. Nuclear option: clear the entire queue and cache
          await this.player.setQueue([]);
          await this.player.removeUpcomingTracks();

          // 7. Reset all internal state
          this._loaded = false;
          this._paused = true;
          this._currentStream = CONFIG.DEFAULT_STREAM_OPTION;
          this._currentTrack = null;
          this._currentProgram = null;
          this._listeners = null;
          this.currentProgress = 0;

          // 8. Nullify the service instance
          playerServiceInstance = null;

          console.log("[PlayerService] Player instance reduced to atoms.");
        } catch (error) {
          console.error("[PlayerService] Destruction failed:", error);
          // Consider retry logic or error reporting here
        } finally {
          // 9. Force garbage collection (Android only)
          if (Platform.OS === "android") {
            (global as any).NativeModules?.TrackPlayer?.gc();
          }
        }
      },
    };
  }
  return playerServiceInstance;
};
