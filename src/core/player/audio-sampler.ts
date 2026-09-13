import type { AudioSample } from "expo-audio";
import { resampleWaveform, rms, smoothWaveform } from "./waveform";
import { CONFIG } from "../../utils/player.config";
import type {
  SamplingTransport,
  VisualizerFps,
  VisualizerSampler,
  WaveformFrame,
} from "./visualizer.types";

/**
 * Oscilloscope sampler — turns the native player's decoded-PCM events into
 * compact, display-ready waveform frames.
 *
 * Android-only. Owned by `PlayerService` and fed by `AudioTransport`. It is
 * the single gate for native sampling: sampling only runs while a non-zero
 * frame rate is selected, the app is foregrounded, and audio is playing. It
 * throttles the native ~60 Hz stream to the requested frame rate and smooths
 * between frames so motion stays fluid.
 *
 * Deliberately not a React store: frames arrive up to 60 times a second and
 * must not re-render the app tree. The visualizer component subscribes to it
 * imperatively. The whole module tree is excluded from the iOS bundle by the
 * `visualizer.ios.ts` platform stub.
 */

/** Points in the oscilloscope line. */
const WAVE_POINTS = 128;
/** Assumed native event rate until two samples are measured. */
const DEFAULT_SOURCE_HZ = 60;
/** Bounds for the measured native rate. */
const MIN_SOURCE_HZ = 30;
const MAX_SOURCE_HZ = 120;
/** Intervals shorter than this are not used to measure the source rate. */
const MIN_SAMPLE_INTERVAL_MS = 4;
/** Weight of the previous frame in the temporal smoothing blend. */
const SMOOTHING = 0.45;

export class AudioSampler implements VisualizerSampler {
  private fps: VisualizerFps = 0;
  private foreground = true;
  private playing = false;

  private transportSubscription: (() => void) | null = null;
  private readonly listeners = new Set<(frame: WaveformFrame) => void>();

  /** Fractional frame budget — drops frames to hit the target rate. */
  private emitBudget = 0;
  /** Measured native event rate, adapted per sample. */
  private sourceHz = DEFAULT_SOURCE_HZ;
  private lastSampleAt = 0;
  /** Dev-only: count frames since the last activation. */
  private framesSeen = 0;
  /** Previous wave, used for temporal smoothing. */
  private lastWave: number[] | null = null;

  constructor(private readonly transport: SamplingTransport) {}

  get isSupported(): boolean {
    return this.transport.isSamplingSupported;
  }

  get isActive(): boolean {
    return (
      this.fps > 0 && this.foreground && this.playing && this.isSupported
    );
  }

  setFps(fps: VisualizerFps): void {
    if (this.fps === fps) return;
    this.fps = fps;
    this.apply();
  }

  setForeground(foreground: boolean): void {
    if (this.foreground === foreground) return;
    this.foreground = foreground;
    this.apply();
  }

  setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    this.apply();
  }

  subscribe(listener: (frame: WaveformFrame) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stops sampling and drops listeners. One-way. */
  dispose(): void {
    this.fps = 0;
    this.playing = false;
    this.apply();
    this.listeners.clear();
    this.lastWave = null;
  }

  /** Reconciles the native sampling gate with the current flags. */
  private apply(): void {
    const active = this.isActive;
    if (active) {
      if (!this.transportSubscription) {
        this.transportSubscription = this.transport.onSample((sample) =>
          this.handleSample(sample),
        );
      }
      // Reset state so the first frame after resuming renders immediately.
      this.emitBudget = 0;
      this.framesSeen = 0;
      this.lastWave = null;
      this.transport.setSamplingEnabled(true);
      if (CONFIG.DEBUG) {
        console.info(`[AudioSampler] sampling ON (fps=${this.fps})`);
      }
      return;
    }

    this.transport.setSamplingEnabled(false);
    this.transportSubscription?.();
    this.transportSubscription = null;
    if (CONFIG.DEBUG) console.info("[AudioSampler] sampling OFF");
  }

  private handleSample(sample: AudioSample): void {
    if (!this.isActive) return;
    if (CONFIG.DEBUG && this.framesSeen === 0) {
      console.info(
        `[AudioSampler] first frame: channels=${sample.channels?.length ?? 0} frames=${sample.channels?.[0]?.frames?.length ?? 0}`,
      );
    }
    this.framesSeen++;
    this.measureSourceRate();
    if (!this.shouldEmit()) return;

    const frames = sample.channels?.[0]?.frames ?? [];
    const wave = smoothWaveform(
      this.lastWave,
      resampleWaveform(frames, WAVE_POINTS),
      SMOOTHING,
    );
    this.lastWave = wave;
    const frame: WaveformFrame = { wave, level: rms(frames) };

    this.listeners.forEach((listener) => listener(frame));
  }

  /** Tracks the native event cadence so decimation works on both platforms. */
  private measureSourceRate(): void {
    const now = Date.now();
    if (this.lastSampleAt > 0) {
      const delta = now - this.lastSampleAt;
      // Ignore implausibly short intervals (two events in the same ms, a test
      // burst) so a single outlier can't skew the measured rate.
      if (delta >= MIN_SAMPLE_INTERVAL_MS) {
        const instant = 1000 / delta;
        const bounded = Math.min(MAX_SOURCE_HZ, Math.max(MIN_SOURCE_HZ, instant));
        this.sourceHz = this.sourceHz * 0.9 + bounded * 0.1;
      }
    }
    this.lastSampleAt = now;
  }

  /**
   * Decimates the native stream to the configured rate. Uses a fractional
   * budget against the *measured* source rate rather than wall-clock
   * throttling, so the target is respected regardless of native cadence.
   */
  private shouldEmit(): boolean {
    const fps = this.fps;
    if (fps <= 0) return false;
    const ratio = fps / this.sourceHz;
    if (ratio >= 1) return true;
    this.emitBudget += ratio;
    if (this.emitBudget < 1) return false;
    this.emitBudget -= 1;
    return true;
  }
}
