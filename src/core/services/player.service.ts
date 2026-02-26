import { HistoryType } from "./../../@types/history-type.d";
import TrackPlayer, {
  NowPlayingMetadata,
  State,
} from "react-native-track-player";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openBrowserAsync } from "expo-web-browser";
import { Stream } from "../domain/stream";
import { getTrackProgress, Track } from "../domain/track";
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
  _paused: boolean;
  _isRefreshing: boolean;
  _lastMetadataTitle: string;
  /** Whether to show real progress in the media session notification */
  _showMediaProgress: boolean;
  isPlayerSetup: () => Promise<boolean>;
  _isRealTrack: (track: Track) => boolean;
  _resetMediaSession: () => Promise<void>;
  refreshData: (isToUpdateMetadata?: boolean) => Promise<boolean>;
  getNowPlayingMetadata: () => NowPlayingMetadata;
  preload: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  changeStream: (stream: Stream) => Promise<void>;
  openPedidosURL: () => Promise<void>;
  updateMetadata: () => Promise<void>;
  updateNowPlayingProgress: () => Promise<void>;
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
      _paused: true,
      _lastMetadataTitle: "",
      _showMediaProgress: false,

      _isRefreshing: false,

      _isRealTrack(track: Track): boolean {
        return (
          !track.anime?.toLowerCase().includes("passagem") &&
          !track.artist?.toLowerCase().includes("r\u00e1dio animu") &&
          !track.anime?.toLowerCase().includes("animu")
        );
      },

      async _resetMediaSession(): Promise<void> {
        // Push a clean 0/0 metadata so the native player fully resets
        // its progress bar before we set new values.
        this._showMediaProgress = false;
        // Only push if the player is actually set up — avoids heavy
        // native calls (getPlaybackState, getActiveTrack) when not needed.
        if (!(await this.isPlayerSetup())) {
          console.log(
            "[PlayerService] _resetMediaSession: skipped (player not set up)",
          );
          return;
        }
        console.log("[PlayerService] _resetMediaSession: pushing 0/0");
        try {
          const meta = this.getNowPlayingMetadata();
          await this.player.updateNowPlayingMetadata(meta);
        } catch {
          // best-effort
        }
      },

      async isPlayerSetup(): Promise<boolean> {
        try {
          // 1. Native TrackPlayer must be initialized
          const { state } = await TrackPlayer.getPlaybackState();
          if (state === State.None) return false;

          // 2. App player must have been polled at least once
          if (!this._currentTrack) return false;

          // 3. Media session must have a track loaded
          const activeTrack = await TrackPlayer.getActiveTrack();
          if (!activeTrack) return false;

          return true;
        } catch {
          return false;
        }
      },

      async refreshData(isToUpdateMetadata = true): Promise<boolean> {
        if (this._isRefreshing) return false;
        this._isRefreshing = true;
        try {
          await userSettingsService.initialize();

          const [newTrack, newProgram, newListeners, newLastRequestedTracks] =
            await Promise.all([
              animuService.getCurrentTrack(
                this._currentStream,
                userSettingsService.getCurrentSettings().liveQualityCover,
              ),
              animuService.getCurrentProgram(this._currentStream),
              animuService.getCurrentListeners(this._currentStream),
              animuService.getTrackHistory("requests"),
            ]);

          if (!newTrack) {
            console.warn(
              "[PlayerService] API returned invalid track data, skipping update",
            );
            return false;
          }

          let hasChanges = false;

          if (
            this._currentTrack?.raw !== newTrack.raw ||
            this._currentTrack?.artwork !== newTrack.artwork
          ) {
            console.log(
              "[PlayerService] Track changed:",
              newTrack.raw,
              "| isLive:",
              newProgram.isLive,
            );

            const prevTrackRaw = this._currentTrack?.raw;
            this._currentTrack = newTrack;
            this.refreshHistory("played");
            hasChanges = true;

            // Always fully reset media session progress on track change
            await this._resetMediaSession();

            // Start progress for real tracks that are actively playing.
            // NOTE: seekTo is deferred to AFTER updateMetadata below —
            // otherwise updateMetadata would trigger a notification
            // rebuild that reads ExoPlayer's real position and resets the bar.
            if (
              !this._paused &&
              this._isRealTrack(newTrack) &&
              !newProgram.isLive
            ) {
              this._showMediaProgress = true;
              const elapsed = getTrackProgress(newTrack);
              console.log(
                "[PlayerService] refreshData: new track progress ON | elapsed:",
                elapsed != null ? Math.round(elapsed / 1000) + "s" : "null",
                "| duration:",
                Math.round(newTrack.duration / 1000) + "s",
              );
            } else {
              console.log(
                "[PlayerService] refreshData: progress OFF | paused:",
                this._paused,
                "| isReal:",
                this._isRealTrack(newTrack),
                "| isLive:",
                newProgram.isLive,
              );
            }
          }

          if (
            this._currentProgram?.name !== newProgram.name ||
            this._currentProgram?.dj !== newProgram.dj ||
            this._currentProgram?.isLive !== newProgram.isLive
          ) {
            console.log(
              "[PlayerService] Program changed:",
              newProgram.name,
              "| dj:",
              newProgram.dj,
              "| isLive:",
              newProgram.isLive,
            );
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

          if (
            hasChanges &&
            (await this.isPlayerSetup()) &&
            isToUpdateMetadata
          ) {
            await this.updateMetadata();

            // Android: after metadata is pushed, sync ExoPlayer's position
            // to the real track elapsed. This MUST be the last operation —
            // any subsequent updateNowPlayingMetadata would trigger a
            // notification rebuild that reads ExoPlayer's real stream
            // position (≈0 for ICY) and reset the bar.
            if (
              Platform.OS === "android" &&
              this._showMediaProgress &&
              this._currentTrack
            ) {
              const elapsed = getTrackProgress(this._currentTrack);
              if (elapsed != null) {
                console.log(
                  "[PlayerService] refreshData: Android seekTo (after metadata)",
                  Math.round(elapsed / 1000) + "s",
                );
                try {
                  // await TrackPlayer.seekTo(elapsed / 1000);
                } catch (e) {
                  console.warn("[PlayerService] refreshData: seekTo failed", e);
                }
              }
            }
          }

          return hasChanges;
        } catch (error) {
          console.error("[PlayerService] Error refreshing data:", error);
          return false;
        } finally {
          this._isRefreshing = false;
        }
      },

      getNowPlayingMetadata(): NowPlayingMetadata {
        const baseMetadata = this._currentTrack?.metadata || {
          title: "N/A",
          artist: "N/A",
          date: "N/A",
          genre: "N/A",
          description: "N/A",
          duration: 0,
          artwork: CONFIG.DEFAULT_COVER,
        };

        const isLive = this._currentProgram?.isLive ?? false;

        // Show REAL elapsed/duration from the track data
        if (this._showMediaProgress && this._currentTrack) {
          const elapsed = getTrackProgress(this._currentTrack);
          if (elapsed != null) {
            const durationSec = this._currentTrack.duration / 1000;
            const elapsedSec = elapsed / 1000;
            return {
              ...baseMetadata,
              duration: durationSec,
              elapsedTime: elapsedSec,
              isLiveStream: isLive,
            };
          }
        }

        // No progress: send 0/0 so the bar is empty/hidden
        return {
          ...baseMetadata,
          duration: 0,
          elapsedTime: 0,
          isLiveStream: isLive,
        };
      },

      async preload(): Promise<void> {
        if (await this.isPlayerSetup()) return;

        try {
          await SetupService();

          const storedStream = await AsyncStorage.getItem("currentStream");
          this._currentStream = storedStream
            ? JSON.parse(storedStream)
            : CONFIG.DEFAULT_STREAM_OPTION;

          // Add a paused track so the system media session shows
          // current track info immediately (before the user presses play).
          if (this._currentTrack) {
            const metadata = this.getNowPlayingMetadata();
            await TrackPlayer.add({
              id: "1",
              url: this._currentStream.url,
              userAgent: CONFIG.USER_AGENT,
              title: metadata.title,
              artist: metadata.artist,
              artwork: metadata.artwork,
            });
            await this.updateMetadata();
          }

          console.log("[PlayerService] Player preloaded (paused).");
        } catch (err) {
          console.error("[PlayerService] Preload error:", err);
        }
      },

      async play(): Promise<void> {
        console.log("[PlayerService] Play requested.");

        // Narrow check: only need to know if native SetupService() was called
        let nativeReady = false;
        try {
          await TrackPlayer.getPlaybackState();
          nativeReady = true;
        } catch {
          // Player not initialized yet
        }

        if (!nativeReady) {
          try {
            await SetupService();

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

          const metadata = this.getNowPlayingMetadata();

          // Add the track without duration/elapsedTime — the native player
          // would use its own stream position (always 0 for ICY streams),
          // conflicting with our calculated track progress.
          // We push the correct progress via updateNowPlayingMetadata after play.
          await TrackPlayer.add({
            id: "1",
            url: this._currentStream.url,
            userAgent: CONFIG.USER_AGENT,
            title: metadata.title,
            artist: metadata.artist,
            artwork: metadata.artwork,
          });

          await TrackPlayer.play();
          this._paused = false;

          // Start media session progress for real tracks
          this._showMediaProgress = false;
          if (
            this._currentTrack &&
            this._currentProgram &&
            this._isRealTrack(this._currentTrack) &&
            !this._currentProgram.isLive
          ) {
            this._showMediaProgress = true;
            const elapsed = getTrackProgress(this._currentTrack);
            console.log(
              "[PlayerService] play: progress ON | elapsed:",
              elapsed != null ? Math.round(elapsed / 1000) + "s" : "null",
              "| duration:",
              Math.round(this._currentTrack.duration / 1000) + "s",
            );
          } else {
            console.log(
              "[PlayerService] play: progress OFF (not a real track or live)",
            );
          }

          // Push full metadata with real elapsed/duration
          await this.updateMetadata();

          // Android: ExoPlayer position starts at 0 for ICY streams.
          // Seek to the real elapsed time ONCE so the notification bar
          // matches. After this, the bar auto-advances on both platforms.
          if (
            Platform.OS === "android" &&
            this._showMediaProgress &&
            this._currentTrack
          ) {
            const elapsed = getTrackProgress(this._currentTrack);
            if (elapsed != null) {
              console.log(
                "[PlayerService] play: Android seekTo",
                Math.round(elapsed / 1000) + "s",
              );
              // await TrackPlayer.seekTo(elapsed / 1000);
            }
          }
        } catch (error) {
          console.error("[PlayerService] Playback error:", error);
          throw error;
        }
      },

      async pause(): Promise<void> {
        if ((await this.isPlayerSetup()) && !this._paused) {
          try {
            await TrackPlayer.pause();
            this._paused = true;
            // Fully clear media session progress
            this._showMediaProgress = false;
            console.log("[PlayerService] pause: progress cleared, pushing 0/0");
            const pauseMetadata = this.getNowPlayingMetadata();
            await this.player.updateNowPlayingMetadata(pauseMetadata);
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
          const titleKey = `${newMetadata.title}|${newMetadata.artist}`;
          if (this._lastMetadataTitle !== titleKey) {
            console.log(
              "[PlayerService] 🎵 Updating metadata:",
              newMetadata.title,
              "-",
              newMetadata.artist,
            );
            this._lastMetadataTitle = titleKey;
          }
          await this.player.updateNowPlayingMetadata(newMetadata);
        } catch (error) {
          console.error("[PlayerService] Metadata update error:", error);
        }
      },

      async updateNowPlayingProgress(): Promise<void> {
        if (this._paused || !this._currentTrack) return;
        if (!this._showMediaProgress) return;

        // We do NOT push metadata every second.
        // Both iOS and Android auto-advance the progress bar after the
        // initial elapsedTime/seekTo sync. Pushing updateNowPlayingMetadata
        // each tick causes Android to rebuild the notification and re-read
        // ExoPlayer's real stream position (≈0 for ICY), resetting the bar.
        //
        // This function only detects when the track has ended so we can
        // clear the progress bar.
        const elapsed = getTrackProgress(this._currentTrack);
        if (elapsed == null) {
          console.log(
            "[PlayerService] updateProgress: track ended, clearing progress",
          );
          this._showMediaProgress = false;
          try {
            if (await this.isPlayerSetup()) {
              const cleanMeta = this.getNowPlayingMetadata();
              await this.player.updateNowPlayingMetadata(cleanMeta);
            }
          } catch {
            // best-effort
          }
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
          if (!tracks || tracks.length === 0) return;

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
            error,
          );
        }
      },

      async destroy(): Promise<void> {
        if (!(await this.isPlayerSetup())) {
          return;
        }

        try {
          await this.player.stop();
          await this.player.reset();

          this._paused = true;
          this._currentStream = CONFIG.DEFAULT_STREAM_OPTION;
          this._currentTrack = null;
          this._currentProgram = null;
          this._listeners = null;
          this._showMediaProgress = false;

          playerServiceInstance = null;
        } catch (error) {
          console.error("[PlayerService] Destruction failed:", error);
        }
      },
    };
  }

  return playerServiceInstance;
};
