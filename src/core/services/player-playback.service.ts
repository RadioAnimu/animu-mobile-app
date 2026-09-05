import {
  PlaybackControls,
  type CommandEvent,
  type ListenerSubscription,
  type NowPlayingMetadata,
  type PlaybackSession,
  type PlaybackStatus,
} from "react-native-playback-controls";

let remotePlayHandler: (() => Promise<void>) | null = null;
let remotePauseHandler: (() => Promise<void>) | null = null;
let remoteStopHandler: (() => Promise<void>) | null = null;
let remoteToggleHandler: (() => Promise<void>) | null = null;

let session: PlaybackSession | null = null;
let subscription: ListenerSubscription | null = null;

export const setRemotePlaybackHandlers = (handlers: {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop?: () => Promise<void>;
  toggle?: () => Promise<void>;
}) => {
  remotePlayHandler = handlers.play;
  remotePauseHandler = handlers.pause;
  remoteStopHandler = handlers.stop ?? null;
  remoteToggleHandler = handlers.toggle ?? null;
};

const handleCommand = async (event: CommandEvent) => {
  // Handlers delegate to playerService.play()/pause(), which drive the
  // transport state machine — no extra state syncing needed here.
  switch (event.command) {
    case "play":
      try {
        await remotePlayHandler?.();
      } catch (error) {
        console.error("[PlaybackService] Remote play error:", error);
      }
      break;
    case "pause":
      try {
        await remotePauseHandler?.();
      } catch (error) {
        console.error("[PlaybackService] Remote pause error:", error);
      }
      break;
    case "toggle-play-pause":
      try {
        if (remoteToggleHandler) {
          await remoteToggleHandler();
        } else if (remotePlayHandler) {
          await remotePlayHandler();
        }
      } catch (error) {
        console.error("[PlaybackService] Remote toggle error:", error);
      }
      break;
    case "stop":
      try {
        await remoteStopHandler?.();
      } catch (error) {
        console.error("[PlaybackService] Remote stop error:", error);
      }
      break;
  }
};

/**
 * Starts the app-wide "now playing" session and wires remote command
 * listeners. Idempotent — returns the existing session when active.
 *
 * No POST_NOTIFICATIONS request: like react-native-track-player, the media
 * card renders from the MediaSession and works on Android 13+ without it —
 * only the classic FGS notification is suppressed when it is denied.
 */
export async function StartPlaybackSession(): Promise<PlaybackSession | null> {
  if (session && !session.isEnded) {
    return session;
  }

  try {
    session = await PlaybackControls.startSession({
      commands: ["play", "pause", "toggle-play-pause", "stop"],
    });

    subscription?.remove();
    subscription = session.addCommandListener((event) => {
      handleCommand(event);
    });

    return session;
  } catch (error) {
    console.error("[PlaybackService] Failed to start session:", error);
    return null;
  }
}

export const getPlaybackSession = (): PlaybackSession | null =>
  session && !session.isEnded ? session : null;

/** Numbers the native media session can safely consume. Kotlin's
 * `roundToLong()` throws on NaN — one bad position/duration crossing the
 * bridge crashes the media-session pipeline (notification freezes until
 * the app restarts), so non-finite values are dropped at the boundary. */
const finiteOrUndefined = (
  value: number | null | undefined,
): number | undefined =>
  value != null && Number.isFinite(value) ? value : undefined;

/** Pushes now-playing metadata to the system media UI. Best-effort. */
export const setNowPlayingMetadata = (metadata: NowPlayingMetadata): void => {
  try {
    getPlaybackSession()?.setNowPlaying({
      ...metadata,
      durationSec: finiteOrUndefined(metadata.durationSec),
    });
  } catch (error) {
    console.warn("[PlaybackService] setNowPlaying failed:", error);
  }
};

/** Pushes the playback status (and optional position) to the media UI. */
export const setRemotePlaybackStatus = (
  status: PlaybackStatus,
  positionSec?: number,
): void => {
  try {
    getPlaybackSession()?.setPlaybackState({
      status,
      positionSec: finiteOrUndefined(positionSec),
    });
  } catch (error) {
    console.warn("[PlaybackService] setPlaybackState failed:", error);
  }
};

export async function EndPlaybackSession(): Promise<void> {
  subscription?.remove();
  subscription = null;
  const current = session;
  session = null;
  try {
    await current?.end();
  } catch (error) {
    console.warn("[PlaybackService] End session failed:", error);
  }
}
