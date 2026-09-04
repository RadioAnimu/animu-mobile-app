import type { PlaybackStatus } from "react-native-playback-controls";

// ─── Transport state machine ───
// Explicit lifecycle instead of independent booleans ("paused", "started").
// The user's *intent* is any state where they last pressed play:
// connecting | playing | reconnecting. "idle" means not set up / destroyed.

export type TransportState =
  | "idle" // no setup or destroyed — cannot play
  | "connecting" // play() requested, stream not producing audio yet
  | "playing" // audio actually flowing
  | "paused" // user paused
  | "reconnecting"; // stream lost while user wants audio; backoff scheduled

const TRANSPORT_TRANSITIONS: Record<TransportState, readonly TransportState[]> =
  {
    idle: ["connecting"],
    connecting: ["playing", "paused", "reconnecting", "idle"],
    playing: ["connecting", "paused", "reconnecting", "idle"],
    paused: ["connecting", "idle"],
    // "playing" is allowed: the native layer may recover a stream on its
    // own (e.g. ExoPlayer re-buffering) without an explicit reconnect.
    reconnecting: ["connecting", "playing", "paused", "idle"],
  };

export const isPlayingIntentState = (state: TransportState): boolean =>
  state === "connecting" || state === "playing" || state === "reconnecting";

/** Maps the transport state to a media-session PlaybackStatus. */
export const toRemoteStatus = (state: TransportState): PlaybackStatus => {
  switch (state) {
    case "playing":
      return "playing";
    case "connecting":
    case "reconnecting":
      return "buffering";
    case "paused":
      return "paused";
    default:
      return "stopped";
  }
};

/**
 * Pure transport lifecycle. Refuses invalid transitions (warn + ignore) and
 * tracks when the current state was entered — the death-detection grace
 * window is derived from `enteredAt`.
 */
export class TransportStateMachine {
  private current: TransportState = "idle";
  private enteredAtMs: number = Date.now();

  get state(): TransportState {
    return this.current;
  }

  /** Date.now() when the state last changed. */
  get enteredAt(): number {
    return this.enteredAtMs;
  }

  /** Whether the user's last action was "play" (covers the intent chain). */
  get isPlayingIntent(): boolean {
    return isPlayingIntentState(this.current);
  }

  get remoteStatus(): PlaybackStatus {
    return toRemoteStatus(this.current);
  }

  transition(next: TransportState): void {
    if (this.current === next) return;

    if (!TRANSPORT_TRANSITIONS[this.current].includes(next)) {
      console.warn(
        `[TransportState] Invalid transport transition: ${this.current} → ${next} (ignored)`,
      );
      return;
    }

    this.current = next;
    this.enteredAtMs = Date.now();
  }
}
