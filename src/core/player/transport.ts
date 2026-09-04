import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioStatus,
  type AudioSource,
} from "expo-audio";
import { CONFIG } from "../../utils/player.config";
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

  get hasPlayer(): boolean {
    return this.player != null;
  }

  /** Whether the audio mode + media session setup has completed. */
  get isSessionReady(): boolean {
    return this.sessionReady;
  }

  /** Registers the native status handler (call once, before first play). */
  setStatusHandler(handler: (status: AudioStatus) => void): void {
    this.statusHandler = handler;
  }

  /** Runs the one-time native setup (idempotent). Throws on failure. */
  async ensureSession(): Promise<void> {
    if (this.sessionReady) return;
    await SetupService();
    this.sessionReady = true;
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
    });
    this.attachStatusListener();
  }

  /** Resumes playback of the loaded source. */
  resume(): void {
    this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  /** Removes the status listener and destroys the native player. */
  dispose(): void {
    this.statusSubscription?.remove();
    this.statusSubscription = null;
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
