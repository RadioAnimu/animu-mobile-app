/**
 * Player ports — the vocabulary the player core uses to talk to the native
 * audio engine and the OS media session.
 *
 * Nothing here imports `expo-audio` or `react-native-playback-controls`: the
 * concrete libraries live only in `./adapters`. Swapping the audio library —
 * or adopting a single library that provides both audio and media controls —
 * is then a matter of writing an adapter that implements these interfaces and
 * wiring it in `player-service.ts`'s factory.
 */

// ── Lib-agnostic value types ──

/** The subset of native playback status the core reacts to. */
export interface AudioPlaybackStatus {
  /** Whether audio is currently playing. */
  playing: boolean;
  /** Whether the player is buffering. */
  isBuffering: boolean;
  /** Time-control status ("playing" / "paused" / "waiting"). */
  timeControlStatus: string;
  /** Native playback state ("idle" / "ended" / "failed" / …). */
  playbackState: string;
}

/** One decoded PCM channel (frames normalized -1..1). */
export interface AudioSampleChannel {
  frames: number[];
}

/** One decoded PCM window plus optional platform latency metadata. */
export interface AudioSample {
  channels: AudioSampleChannel[];
  /** Sample timestamp relative to the track timeline, in seconds. */
  timestamp: number;
  /** Android tap's measured output latency (seconds), when available. */
  outputLatencySeconds?: number;
}

/** Metadata shown on the lock screen / notification / connected surfaces. */
export interface NowPlayingMetadata {
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  durationSec?: number;
  isLiveStream?: boolean;
}

/** Coarse playback status surfaced to the system "now playing" UI. */
export type RemotePlaybackStatus =
  | "playing"
  | "paused"
  | "stopped"
  | "buffering";

/** Remote media-session commands the app honours. */
export interface RemoteCommandHandlers {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop?: () => Promise<void>;
  toggle?: () => Promise<void>;
}

// ── Ports ──

/**
 * The audio engine: a native player that opens a live stream and reports
 * status + decoded PCM. Implemented by `ExpoAudioAdapter`.
 */
export interface AudioEnginePort {
  /** Whether a native player has been created. */
  readonly hasPlayer: boolean;
  /** Whether the platform can tap decoded PCM (visualizer). */
  readonly isSamplingSupported: boolean;
  /** Registers the native status handler (call once, before first play). */
  setStatusHandler(handler: (status: AudioPlaybackStatus) => void): void;
  /** Applies the audio-session mode (silent mode / background / focus). Idempotent. */
  ensureAudioMode(): Promise<void>;
  /** Loads (create-or-replace) the source and starts playback. */
  play(url: string): void;
  /** Swaps the source without forcing playback. */
  load(url: string): void;
  /** Resumes the loaded source. */
  resume(): void;
  pause(): void;
  /** Enables/disables native PCM sampling. Never throws. */
  setSamplingEnabled(enabled: boolean): void;
  /** Subscribes to decoded PCM windows; returns an unsubscribe function. */
  onSample(handler: (sample: AudioSample) => void): () => void;
  /** Removes listeners and destroys the native player. */
  dispose(): void;
}

/**
 * The OS media session: lock-screen / notification controls and the metadata
 * + playback state pushed to them. Implemented by `PlaybackControlsAdapter`.
 */
export interface MediaSessionPort {
  /** Registers the remote-command handlers (before or after `start`). */
  setHandlers(handlers: RemoteCommandHandlers): void;
  /** Starts the session (idempotent). Returns whether it is active. */
  start(): Promise<boolean>;
  /** Whether a live session exists. */
  readonly isActive: boolean;
  /** Pushes metadata + status (+ optional position) in one go. */
  push(
    metadata: NowPlayingMetadata,
    status: RemotePlaybackStatus,
    positionSec?: number,
  ): void;
  /** Pushes only the playback status (e.g. on pause). */
  pushStatus(status: RemotePlaybackStatus, positionSec?: number): void;
  /** Ends the session (best-effort). */
  end(): Promise<void>;
}
