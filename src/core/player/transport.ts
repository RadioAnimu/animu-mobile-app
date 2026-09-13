import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioSample,
  type AudioStatus,
  type AudioSource,
} from "expo-audio";
import { CONFIG } from "../../utils/player.config";
import { getPlaybackSession } from "../services/player-playback.service";
import { SetupService } from "../services/player-setup.service";

/**
 * Native-driven tick interval (ms). expo-audio emits playbackStatusUpdate
 * events from the native layer — these keep firing while the app is
 * backgrounded on Android (the foreground service keeps the process alive),
 * unlike Choreographer-driven JS timers which OEMs pause in background.
 */
const PLAYER_TICK_INTERVAL_MS = 1000;

/** Builds an expo-audio source for a live stream with the app User-Agent */
export const buildStreamSource = (url: string): AudioSource => ({
  uri: url,
  headers: { "User-Agent": CONFIG.USER_AGENT },
});

/**
 * Owns the expo-audio player and the native audio-session lifecycle.
 *
 * - `ensureSession()` runs the one-time audio-mode + media-session setup.
 * - `play()` / `load()` / `resume()` / `pause()` drive native playback.
 *   Live streams are always (re)opened at the current live point — there
 *   is no gapless resume, so source replacement IS the reconnect.
 * - `playbackStatusUpdate` events are forwarded to the handler wired by
 *   the orchestrator (progress ticks + stream-loss detection).
 */
export class AudioTransport {
  private player: AudioPlayer | null = null;
  private statusSubscription: { remove(): void } | null = null;
  private statusHandler: ((status: AudioStatus) => void) | null = null;
  private sessionReady = false;

  /** Sampling seam (see `AudioSampler`). */
  private sampleSubscription: { remove(): void } | null = null;
  private sampleHandler: ((sample: AudioSample) => void) | null = null;
  /** Desired sampling state, applied lazily once a player exists. */
  private samplingRequested = false;

  get hasPlayer(): boolean {
    return this.player != null;
  }

  /** Whether the native player can provide decoded PCM on this platform. */
  get isSamplingSupported(): boolean {
    return this.player?.isAudioSamplingSupported ?? false;
  }

  /** Whether the audio mode + media session setup has completed. */
  get isSessionReady(): boolean {
    return this.sessionReady;
  }

  /** Registers the native status handler (call once, before first play). */
  setStatusHandler(handler: (status: AudioStatus) => void): void {
    this.statusHandler = handler;
  }

  /**
   * Runs the one-time native setup (idempotent). Throws on failure.
   *
   * `SetupService` sets the audio mode AND starts the media session, but the
   * session start is best-effort (the OS can refuse if the app isn't in the
   * foreground yet). Marking `sessionReady` unconditionally used to be a
   * one-way trap: the first failure meant no media session for the life of
   * the app and no retry. We verify the session actually exists instead, so
   * callers that await this can surface the failure and try again on the
   * next `play()`.
   */
  async ensureSession(): Promise<void> {
    if (this.sessionReady) return;
    await SetupService();
    this.sessionReady = getPlaybackSession() != null;
    if (!this.sessionReady) {
      throw new Error("[AudioTransport] Playback session unavailable");
    }
  }

  /** Marks the native session as torn down (destroy path). */
  markSessionDown(): void {
    this.sessionReady = false;
  }

  /** Loads the source (create-or-replace) and starts playback. */
  play(url: string): void {
    this.load(url);
    this.player?.play();
  }

  /**
   * Swaps the audio source without forcing playback — keeps a paused
   * player paused. First call creates the player and attaches the
   * status listener; later calls replace the source in place.
   */
  load(url: string): void {
    const source = buildStreamSource(url);
    if (this.player) {
      this.player.replace(source);
      return;
    }
    this.player = createAudioPlayer(source, {
      updateInterval: PLAYER_TICK_INTERVAL_MS,
      // A radio stream must never tear its audio session down. Without this,
      // iOS deactivates the AVAudioSession whenever the player pauses or the
      // item briefly ends — an inactive session in the background lets iOS
      // suspend the app, which also freezes the JS reconnect path, so
      // playback never comes back. (iOS-only; ignored on Android.)
      keepAudioSessionActive: true,
    });
    this.attachStatusListener();
    this.attachSampleListener();
    // The visualizer may have been armed before the player existed.
    if (this.samplingRequested) this.applySampling(true);
  }

  /** Resumes playback of the loaded source. */
  resume(): void {
    this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  /**
   * Enables/disables native PCM sampling (used by the visualizer). The
   * request is remembered so it can be applied when the player is created
   * later. Never throws: a failed toggle must not disturb playback.
   */
  setSamplingEnabled(enabled: boolean): void {
    this.samplingRequested = enabled;
    this.applySampling(enabled);
  }

  /**
   * Registers a decoded-PCM handler and returns an unsubscribe function.
   * Only one handler is supported (the visualizer); a new registration
   * replaces the previous one.
   */
  onSample(handler: (sample: AudioSample) => void): () => void {
    this.sampleHandler = handler;
    this.attachSampleListener();
    return () => {
      if (this.sampleHandler === handler) {
        this.sampleHandler = null;
        this.sampleSubscription?.remove();
        this.sampleSubscription = null;
      }
    };
  }

  private applySampling(enabled: boolean): void {
    const player = this.player;
    if (!player) return;
    if (enabled && !player.isAudioSamplingSupported) return;
    try {
      player.setAudioSamplingEnabled(enabled);
    } catch (error) {
      console.warn("[AudioTransport] audio sampling toggle failed:", error);
    }
  }

  private attachSampleListener(): void {
    if (!this.player || !this.sampleHandler || this.sampleSubscription) return;
    this.sampleSubscription = this.player.addListener(
      "audioSampleUpdate",
      (sample: AudioSample) => this.sampleHandler?.(sample),
    );
  }

  /** Removes the status listener and destroys the native player. */
  dispose(): void {
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    this.sampleSubscription?.remove();
    this.sampleSubscription = null;
    this.sampleHandler = null;
    this.samplingRequested = false;
    this.player?.remove();
    this.player = null;
  }

  private attachStatusListener(): void {
    if (!this.player || !this.statusHandler || this.statusSubscription) return;
    this.statusSubscription = this.player.addListener(
      "playbackStatusUpdate",
      (status: AudioStatus) => this.statusHandler?.(status),
    );
  }
}
