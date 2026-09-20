import {
  PlaybackControls,
  type CommandEvent,
  type ListenerSubscription,
  type PlaybackSession,
} from "react-native-playback-controls";
import type {
  MediaSessionPort,
  NowPlayingMetadata,
  RemoteCommandHandlers,
  RemotePlaybackStatus,
} from "@/core/player/ports";

/** Numbers the native media session can safely consume. Kotlin's
 * `roundToLong()` throws on NaN — one bad position/duration crossing the
 * bridge crashes the media-session pipeline (notification freezes until
 * the app restarts), so non-finite values are dropped at the boundary. */
const finiteOrUndefined = (
  value: number | null | undefined,
): number | undefined =>
  value != null && Number.isFinite(value) ? value : undefined;

/**
 * `MediaSessionPort` backed by `react-native-playback-controls`. The only
 * place the media-controls library is imported: everything the app shows on
 * the lock screen / notification goes through {@link MediaSessionPort}.
 *
 * Commands are deliberately limited to play/pause/toggle: the station is a
 * continuous live radio stream, so there is nothing to seek, skip or stop to.
 * The native session card renders from the MediaSession with no
 * POST_NOTIFICATIONS request.
 */
export class PlaybackControlsAdapter implements MediaSessionPort {
  private handlers: RemoteCommandHandlers | null = null;
  private session: PlaybackSession | null = null;
  private subscription: ListenerSubscription | null = null;

  setHandlers(handlers: RemoteCommandHandlers): void {
    this.handlers = handlers;
  }

  get isActive(): boolean {
    return this.session != null && !this.session.isEnded;
  }

  async start(): Promise<boolean> {
    if (this.isActive) return true;
    try {
      await this.beginSession();
      return true;
    } catch (error) {
      // The native session can already be alive from a previous JS instance
      // (a bridge reload, or a teardown whose `end()` failed). `startSession`
      // then rejects and — without this recovery — `isActive` stays false for
      // the whole session, so every `push` is a silent no-op and the lock
      // screen/notification controls stay dead. Tear the stale session down
      // and retry once.
      console.warn(
        "[PlaybackControlsAdapter] start failed, retrying after teardown:",
        error,
      );
      await this.end();
      try {
        await this.beginSession();
        return true;
      } catch (retryError) {
        console.error(
          "[PlaybackControlsAdapter] Failed to start session:",
          retryError,
        );
        return false;
      }
    }
  }

  private async beginSession(): Promise<void> {
    const session = await PlaybackControls.startSession({
      commands: ["play", "pause", "toggle-play-pause"],
    });
    this.session = session;
    this.subscription?.remove();
    this.subscription = session.addCommandListener((event) => {
      void this.handleCommand(event);
    });
  }

  push(
    metadata: NowPlayingMetadata,
    status: RemotePlaybackStatus,
    positionSec?: number,
  ): void {
    this.setNowPlaying(metadata);
    this.setPlaybackState(status, positionSec);
  }

  pushStatus(status: RemotePlaybackStatus, positionSec?: number): void {
    this.setPlaybackState(status, positionSec);
  }

  async end(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;
    const current = this.session;
    this.session = null;
    try {
      await current?.end();
    } catch (error) {
      console.warn("[PlaybackControlsAdapter] End session failed:", error);
    }
  }

  /** Pushes now-playing metadata to the system media UI. Best-effort. */
  private setNowPlaying(metadata: NowPlayingMetadata): void {
    try {
      this.session?.setNowPlaying({
        ...metadata,
        durationSec: finiteOrUndefined(metadata.durationSec),
      });
    } catch (error) {
      console.warn("[PlaybackControlsAdapter] setNowPlaying failed:", error);
    }
  }

  /** Pushes the playback status (and optional position) to the media UI. */
  private setPlaybackState(
    status: RemotePlaybackStatus,
    positionSec?: number,
  ): void {
    try {
      this.session?.setPlaybackState({
        status,
        positionSec: finiteOrUndefined(positionSec),
      });
    } catch (error) {
      console.warn("[PlaybackControlsAdapter] setPlaybackState failed:", error);
    }
  }

  private async handleCommand(event: CommandEvent): Promise<void> {
    const handlers = this.handlers;
    if (!handlers) return;
    try {
      switch (event.command) {
        case "play":
          await handlers.play();
          break;
        case "pause":
          await handlers.pause();
          break;
        case "toggle-play-pause":
          await (handlers.toggle ?? handlers.play)();
          break;
        case "stop":
          await handlers.stop?.();
          break;
      }
    } catch (error) {
      console.error("[PlaybackControlsAdapter] Remote command error:", error);
    }
  }
}
