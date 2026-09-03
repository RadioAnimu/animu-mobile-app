import { PermissionsAndroid, Platform } from "react-native";
import {
  PlaybackControls,
  type CommandEvent,
  type ListenerSubscription,
  type NowPlayingMetadata,
  type PlaybackSession,
  type PlaybackStatus,
} from "react-native-playback-controls";

let updatePlayerState: ((isPlaying: boolean) => void) | null = null;
let remotePlayHandler: (() => Promise<void>) | null = null;
let remotePauseHandler: (() => Promise<void>) | null = null;
let remoteStopHandler: (() => Promise<void>) | null = null;
let remoteToggleHandler: (() => Promise<void>) | null = null;

let session: PlaybackSession | null = null;
let subscription: ListenerSubscription | null = null;

export const setPlayerStateUpdater = (
  updater: (isPlaying: boolean) => void,
) => {
  updatePlayerState = updater;
};

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
  switch (event.command) {
    case "play":
      try {
        if (remotePlayHandler) {
          await remotePlayHandler();
        }
        updatePlayerState?.(true);
      } catch (error) {
        console.error("[PlaybackService] Remote play error:", error);
      }
      break;
    case "pause":
      try {
        if (remotePauseHandler) {
          await remotePauseHandler();
        }
        updatePlayerState?.(false);
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
        if (remoteStopHandler) {
          await remoteStopHandler();
        }
        updatePlayerState?.(false);
      } catch (error) {
        console.error("[PlaybackService] Remote stop error:", error);
      }
      break;
  }
};

const requestNotificationPermission = async (): Promise<void> => {
  if (Platform.OS !== "android" || Platform.Version < 33) return;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn(
        "[PlaybackService] POST_NOTIFICATIONS denied — media notification will not show",
      );
    }
  } catch (error) {
    console.warn("[PlaybackService] Permission request failed:", error);
  }
};

/**
 * Starts the app-wide "now playing" session and wires remote command
 * listeners. Idempotent — returns the existing session when active.
 */
export async function StartPlaybackSession(): Promise<PlaybackSession | null> {
  if (session && !session.isEnded) {
    return session;
  }

  try {
    await requestNotificationPermission();

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

/** Pushes now-playing metadata to the system media UI. Best-effort. */
export const setNowPlayingMetadata = (metadata: NowPlayingMetadata): void => {
  try {
    getPlaybackSession()?.setNowPlaying(metadata);
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
    getPlaybackSession()?.setPlaybackState({ status, positionSec });
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
