import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioSample as ExpoAudioSample,
  type AudioSource,
  type AudioStatus as ExpoAudioStatus,
} from "expo-audio";
import { Platform } from "react-native";
import SILENCE_LOOP from "@app/assets/silence-loop.wav";
import { CONFIG } from "@/utils/player.config";
import { LIVE_FORWARD_BUFFER_SECONDS } from "@/core/player/stream-playback/live-buffer";
import type {
  AudioEnginePort,
  AudioPlaybackStatus,
  AudioSample,
} from "@/core/player/ports";

/**
 * Native-driven tick interval (ms). expo-audio emits playbackStatusUpdate
 * events from the native layer — these keep firing while the app is
 * backgrounded on Android (the foreground service keeps the process alive),
 * unlike Choreographer-driven JS timers which OEMs pause in background.
 */
const PLAYER_TICK_INTERVAL_MS = 1000;

/** Builds an expo-audio source for a live stream with the app User-Agent. */
const buildStreamSource = (url: string): AudioSource => ({
  uri: url,
  headers: { "User-Agent": CONFIG.USER_AGENT },
});

/** Options every player shares (session must never be torn down on pause/end). */
const buildPlayerOptions = () => ({
  updateInterval: PLAYER_TICK_INTERVAL_MS,
  // A radio stream must never tear its audio session down. Without this,
  // iOS deactivates the AVAudioSession whenever the player pauses or the
  // item briefly ends — an inactive session in the background lets iOS
  // suspend the app, which also freezes the JS reconnect path, so
  // playback never comes back. (iOS-only; ignored on Android.)
  keepAudioSessionActive: true,
  // Start the stream ASAP (see `live-buffer.*`). On Android the native
  // tap applies this as an ExoPlayer buffer cap only when > 0.
  preferredForwardBufferDuration: LIVE_FORWARD_BUFFER_SECONDS,
});

/**
 * Projects the native `AudioStatus` onto the core's `AudioPlaybackStatus`.
 *
 * `bufferedAhead` is added by the app's `expo-audio` patch (both platforms)
 * and is therefore not in the package's TypeScript surface — read it through
 * a narrow cast and default it to `null` on an unpatched build.
 */
const toPortStatus = (status: ExpoAudioStatus): AudioPlaybackStatus => ({
  playing: status.playing,
  isBuffering: status.isBuffering,
  timeControlStatus: status.timeControlStatus,
  playbackState: status.playbackState,
  isLive: status.isLive,
  currentOffsetFromLive: status.currentOffsetFromLive ?? null,
  bufferedAheadSeconds:
    (status as { bufferedAhead?: number | null }).bufferedAhead ?? null,
  currentTime: status.currentTime,
});

/**
 * `AudioEnginePort` backed by `expo-audio`. The only place the audio library
 * is imported: the player core talks to {@link AudioEnginePort}, so swapping
 * the audio engine means writing a new adapter, not touching the core.
 *
 * - `ensureAudioMode()` applies the app-wide audio-session mode (idempotent).
 * - `play()` / `load()` / `resume()` / `pause()` drive native playback. Live
 *   streams are always (re)opened at the current live point — there is no
 *   gapless resume, so source replacement IS the reconnect.
 * - `playbackStatusUpdate` events are forwarded to the handler wired by the
 *   orchestrator (progress ticks + stream-loss detection).
 * - `audioSampleUpdate` events feed the visualizer.
 */
export class ExpoAudioAdapter implements AudioEnginePort {
  private player: AudioPlayer | null = null;
  private statusSubscription: { remove(): void } | null = null;
  private statusHandler: ((status: AudioPlaybackStatus) => void) | null = null;
  private sampleSubscription: { remove(): void } | null = null;
  private sampleHandler: ((sample: AudioSample) => void) | null = null;
  /** Desired sampling state, applied lazily once a player exists. */
  private samplingRequested = false;
  private audioModeReady = false;
  /** Dedicated silent loop that keeps the audio session rendering (see port). */
  private keepalive: AudioPlayer | null = null;

  get hasPlayer(): boolean {
    return this.player != null;
  }

  get isSamplingSupported(): boolean {
    return this.player?.isAudioSamplingSupported ?? false;
  }

  setStatusHandler(handler: (status: AudioPlaybackStatus) => void): void {
    this.statusHandler = handler;
  }

  async ensureAudioMode(): Promise<void> {
    if (this.audioModeReady) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
    this.audioModeReady = true;
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
    this.player = createAudioPlayer(source, buildPlayerOptions());
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

  /**
   * Starts the silent keepalive loop (idempotent). The loop is a dedicated
   * looping player playing the bundled near-silent track — genuinely silent
   * samples are avoided (1 LSB amplitude ≈ -90 dBFS) so no pipeline can
   * optimize zero frames away and the loop is inaudible at any volume.
   *
   * Volume must be NONZERO: iOS background-audio enforcement requires the
   * app to be actively rendering audio, and a player at volume 0 can be
   * treated as idle — the app is then suspended seconds after the real
   * stream goes silent (observed: player dismissed ~12s into an outage).
   * The 1-LSB samples keep the loop inaudible even at full volume, so a
   * small nonzero volume is used as a belt-and-braces guarantee that the
   * OS counts this as active playback.
   *
   * iOS-only. On Android the playback foreground service already keeps the
   * process alive through outages, and a second ExoPlayer instance would
   * just burn battery against nothing.
   */
  startKeepalive(): void {
    if (Platform.OS !== "ios") return;
    if (this.keepalive) return;
    try {
      const player = createAudioPlayer(
        SILENCE_LOOP as unknown as AudioSource,
        buildPlayerOptions(),
      );
      player.loop = true;
      player.volume = 0.01;
      player.play();
      this.keepalive = player;
    } catch (error) {
      console.warn("[ExpoAudioAdapter] keepalive start failed:", error);
    }
  }

  stopKeepalive(): void {
    const keepalive = this.keepalive;
    if (!keepalive) return;
    this.keepalive = null;
    try {
      keepalive.pause();
      keepalive.remove();
    } catch (error) {
      console.warn("[ExpoAudioAdapter] keepalive stop failed:", error);
    }
  }

  /** Removes listeners and destroys the native player. */
  dispose(): void {
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    this.sampleSubscription?.remove();
    this.sampleSubscription = null;
    this.sampleHandler = null;
    this.samplingRequested = false;
    this.keepalive?.remove();
    this.keepalive = null;
    this.player?.remove();
    this.player = null;
  }

  private applySampling(enabled: boolean): void {
    const player = this.player;
    if (!player) return;
    if (enabled && !player.isAudioSamplingSupported) return;
    try {
      player.setAudioSamplingEnabled(enabled);
    } catch (error) {
      console.warn("[ExpoAudioAdapter] audio sampling toggle failed:", error);
    }
  }

  private attachSampleListener(): void {
    if (!this.player || !this.sampleHandler || this.sampleSubscription) return;
    this.sampleSubscription = this.player.addListener(
      "audioSampleUpdate",
      (sample: ExpoAudioSample) => this.sampleHandler?.(sample),
    );
  }

  private attachStatusListener(): void {
    if (!this.player || !this.statusHandler || this.statusSubscription) return;
    this.statusSubscription = this.player.addListener(
      "playbackStatusUpdate",
      (status: ExpoAudioStatus) => this.statusHandler?.(toPortStatus(status)),
    );
  }
}
