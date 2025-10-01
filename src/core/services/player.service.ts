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

// ============================================================================
// * TYPES & INTERFACES
// ============================================================================

export interface PlayerServiceProps {
  // ! Configuration & Core
  CONFIG: typeof CONFIG;
  player: typeof TrackPlayer;

  // ! State Properties
  _currentStream: Stream;
  _currentTrack: Track | null;
  _currentProgram: Program | null;
  _lastRequestedTracks: Track[] | null;
  _lastPlayedTracks: Track[] | null;
  _listeners: Listeners | null;
  _loaded: boolean;
  _paused: boolean;
  currentProgress: number;

  // ! Public Methods
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

// ============================================================================
// * SINGLETON INSTANCE
// ============================================================================

let playerServiceInstance: PlayerServiceProps | null = null;

// ============================================================================

export const playerService = (): PlayerServiceProps => {
  if (!playerServiceInstance) {
    playerServiceInstance = {
      // ! Configuration & Core Setup
      CONFIG,
      player: TrackPlayer,

      // ! Initial State
      _currentStream: CONFIG.DEFAULT_STREAM_OPTION,
      _currentTrack: null,
      _lastPlayedTracks: null,
      _lastRequestedTracks: null,
      _currentProgram: null,
      _listeners: null,
      _loaded: false,
      _paused: true,
      currentProgress: 0,

      // ========================================================================
      // * DATA MANAGEMENT METHODS
      // ========================================================================

      /**
       * ? Refreshes all player data from the API
       * @param isToUpdateMetadata - Whether to update track metadata after refresh
       * @returns Promise<boolean> - True if data changed, false otherwise
       */
      async refreshData(isToUpdateMetadata = true): Promise<boolean> {
        console.log("[PlayerService] Updating status using animuService...");

        try {
          await userSettingsService.initialize();

          // TODO: Parallel API calls for better performance
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

          // * Check for track changes
          if (
            this._currentTrack?.raw !== newTrack.raw ||
            this._currentTrack?.artwork !== newTrack.artwork
          ) {
            this._currentTrack = newTrack;
            this.refreshHistory("played");
            hasChanges = true;
          }

          // * Check for program changes
          if (this._currentProgram?.raw !== newProgram.raw) {
            this._currentProgram = newProgram;
            hasChanges = true;
          }

          // * Check for listener count changes
          if (this._listeners?.value !== newListeners.value) {
            this._listeners = newListeners;
            hasChanges = true;
          }

          // * Check for new requested tracks
          if (
            newLastRequestedTracks.length > 0 &&
            newLastRequestedTracks[0].raw !==
              (this._lastRequestedTracks?.[0]?.raw || "")
          ) {
            this._lastRequestedTracks = newLastRequestedTracks;
            hasChanges = true;
          }

          // * Update metadata if changes detected
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

      /**
       * ? Gets formatted metadata for TrackPlayer
       * @returns NowPlayingMetadata - Formatted metadata object
       */
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

        // * Convert milliseconds to seconds for TrackPlayer
        return {
          ...baseMetadata,
          duration: baseMetadata.duration ? baseMetadata.duration / 1000 : 0,
          elapsedTime: this.currentProgress / 1000,
        };
      },

      // ========================================================================
      // * PLAYBACK CONTROL METHODS
      // ========================================================================

      /**
       * ! Starts audio playback
       * @throws Error if setup or playback fails
       */
      async play(): Promise<void> {
        console.log("[PlayerService] Play requested.");

        // * Initialize player if not loaded
        if (!this._loaded) {
          try {
            console.log("[PlayerService] Initializing player...");

            await SetupService();
            this._loaded = true;

            // * Restore saved stream or use default
            const storedStream = await AsyncStorage.getItem("currentStream");
            this._currentStream = storedStream
              ? JSON.parse(storedStream)
              : CONFIG.DEFAULT_STREAM_OPTION;
          } catch (err) {
            console.error("[PlayerService] Player setup error:", err);
            throw err;
          }
        }

        try {
          // * Reset and prepare player
          await TrackPlayer.reset();
          this._paused = true;

          // * Get fresh data before playing
          await this.refreshData(false);

          // * Add track to player queue
          await TrackPlayer.add({
            id: "1",
            url: this._currentStream.url,
            userAgent: CONFIG.USER_AGENT,
            ...this.getNowPlayingMetadata(),
          });

          // * Start playback
          console.log("[PlayerService] Starting playback.");
          await TrackPlayer.play();
          this._paused = false;

          // * Update metadata after successful start
          await this.updateMetadata();
        } catch (error) {
          console.error("[PlayerService] Playback error:", error);
          throw error;
        }
      },

      /**
       * ! Pauses audio playback
       */
      async pause(): Promise<void> {
        console.log("[PlayerService] Pause requested.");

        if (this._loaded && !this._paused) {
          try {
            await TrackPlayer.pause();
            this._paused = true;
            console.log("[PlayerService] Playback paused.");
          } catch (error) {
            console.error("[PlayerService] Pause error:", error);
          }
        } else {
          console.log(
            "[PlayerService] Pause skipped (already paused or not loaded)."
          );
        }
      },

      /**
       * ? Changes the audio stream
       * @param stream - New stream to switch to
       */
      async changeStream(stream: Stream): Promise<void> {
        if (this._currentStream.id !== stream.id) {
          console.log(
            `[PlayerService] Changing stream from ${this._currentStream.id} to ${stream.id}.`
          );

          const wasPlaying = !this._paused;

          // * Pause current stream
          if (wasPlaying) {
            await this.pause();
          }

          // * Update stream and persist
          this._currentStream = stream;
          await AsyncStorage.setItem("currentStream", JSON.stringify(stream));

          // * Resume with new stream if was playing
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

      // ========================================================================
      // * UTILITY METHODS
      // ========================================================================

      /**
       * ? Opens the song requests URL in browser
       */
      async openPedidosURL(): Promise<void> {
        console.log("[PlayerService] Opening pedidos URL.");
        await openBrowserAsync(API.PEDIDOS_URL);
      },

      /**
       * ? Updates the Now Playing metadata if changes detected
       */
      async updateMetadata(): Promise<void> {
        console.log("[PlayerService] Checking metadata update...");

        try {
          const newMetadata = this.getNowPlayingMetadata();
          const currentMetadata = await this.player.getActiveTrack();

          // * Only update if metadata actually changed
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
        } catch (error) {
          console.error("[PlayerService] Metadata update error:", error);
        }
      },

      /**
       * ? Refreshes track history (played or requested)
       * @param typeHistory - Type of history to refresh
       */
      async refreshHistory(typeHistory: HistoryType): Promise<void> {
        // * Initialize arrays if null/undefined
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

          // * Add new tracks, skip duplicates, ignore old tracks (>24h)
          for (const track of tracks) {
            if (!targetArray.find((t) => t.raw === track.raw)) {
              targetArray.unshift(track);
            } else if (
              Date.now() - track.startTime.getTime() >
              24 * 60 * 60 * 1000
            ) {
              return; // TODO: This should probably be a break, not return
            }
          }
        } catch (error) {
          console.error(
            `[PlayerService] Error refreshing ${typeHistory} history:`,
            error
          );
        }
      },

      // ========================================================================
      // * CLEANUP METHODS
      // ========================================================================

      /**
       * ! Destroys the player instance and cleans up resources
       */
      async destroy(): Promise<void> {
        console.log("[PlayerService] Destruction sequence initiated.");

        if (!this._loaded) {
          console.log("[PlayerService] Player instance not loaded.");
          return;
        }

        try {
          // * Stop and reset player
          await this.player.stop();
          await this.player.reset();

          // * Reset all state
          this._loaded = false;
          this._paused = true;
          this._currentStream = CONFIG.DEFAULT_STREAM_OPTION;
          this._currentTrack = null;
          this._currentProgram = null;
          this._listeners = null;
          this.currentProgress = 0;

          // * Clear singleton instance
          playerServiceInstance = null;
          console.log("[PlayerService] Player instance destroyed.");
        } catch (error) {
          console.error("[PlayerService] Destruction failed:", error);
        }
      },
    };
  }

  return playerServiceInstance;
};
