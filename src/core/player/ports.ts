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

/**
 * Why the OS paused playback, as reported by the patched native layer:
 *
 * - `focus-loss` (Android): another app took audio focus for good.
 * - `focus-loss-transient` (Android): a call / short clip took focus; the OS
 *   resumes the player when it is handed back.
 * - `focus-delayed` (Android): a start waits for focus; the OS starts it then.
 * - `focus-denied` (Android): a start was refused focus (e.g. during a call).
 * - `noisy` (Android) / `route-lost` (iOS): headphones or Bluetooth went away.
 * - `interruption` (iOS): an `AVAudioSession` interruption (call, Siri, an app
 *   that does not mix). The OS resumes the player if the interruption ends
 *   with `shouldResume`.
 */
export type AudioInterruption =
  | "focus-loss"
  | "focus-loss-transient"
  | "focus-delayed"
  | "focus-denied"
  | "noisy"
  | "route-lost"
  | "interruption";

/** Interruptions the OS may end by resuming the player on its own. */
export const isSelfResumingInterruption = (
  interruption: AudioInterruption,
): boolean =>
  interruption === "focus-loss-transient" ||
  interruption === "focus-delayed" ||
  interruption === "interruption";

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
  /**
   * Whether the source is an indefinite live stream. Present on the native
   * status; absent on hand-built test fixtures.
   */
  isLive?: boolean;
  /**
   * Seconds the audible playhead trails the stream's live edge — the encoder
   * + relay + jitter-buffer + decoder + output stack. iOS derives it from
   * `AVPlayerItem.currentDate()` (absolute wall clock), Android from
   * ExoPlayer's `currentLiveOffset`. `null` when the platform cannot measure
   * it (e.g. an ICY progressive stream ExoPlayer treats as unseekable).
   *
   * This is the counterpart of the visualizer's `outputLatencySeconds` for
   * the *UI* timeline: the sync engine subtracts it so progress tracks what
   * the speaker is producing instead of the station's live point.
   */
  currentOffsetFromLive?: number | null;
  /**
   * Forward buffer depth in seconds — how much audio the player has loaded
   * past the playhead. A patched native field used as the UI-sync fallback
   * when {@link currentOffsetFromLive} is `null` (live ICY/progressive
   * streams often have no manifest window for the platform to measure).
   */
  bufferedAheadSeconds?: number | null;
  /**
   * Current playback position in seconds. For an indefinite stream this is
   * the player's stream-relative playhead; diagnostics only.
   */
  currentTime?: number;
  /**
   * Set while the OS holds the player paused (see {@link AudioInterruption});
   * absent/null otherwise. Without it a system pause that lands mid-buffering
   * is indistinguishable from a network stall.
   */
  interruption?: AudioInterruption | null;
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
  /**
   * Drops the live stream's network connection while staying paused (the
   * paused transport otherwise keeps downloading at the stream bitrate:
   * ExoPlayer indefinitely, AVPlayer for ~110s).
   * The next `play()` re-opens the source. Returns whether the connection was
   * released (false where unsupported).
   */
  releaseStream(): boolean;
  /** Enables/disables native PCM sampling. Never throws. */
  setSamplingEnabled(enabled: boolean): void;
  /** Subscribes to decoded PCM windows; returns an unsubscribe function. */
  onSample(handler: (sample: AudioSample) => void): () => void;
  /**
   * Loop a near-silent track so the audio session keeps rendering while the
   * real stream is unreachable. iOS suspends a backgrounded app seconds after
   * it stops producing audio — freezing the JS reconnect chain with it, so a
   * tunnel outage would otherwise end in a suspended app that never wakes
   * (nothing on iOS re-runs JS on network restore). Idempotent.
   */
  startKeepalive(): void;
  /** Stops the keepalive loop. Safe when it never started. */
  stopKeepalive(): void;
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
