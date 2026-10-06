import type { AudioSample } from "react-native-anything-player";
import type {
  SamplingTransport,
  VisualizerSampler,
  VisualizerWindow,
} from "@/core/player/visualizer/types";

/**
 * Oscilloscope sampler — turns the player's decoded-audio windows into the
 * windows the WebView visualizer interpolates between.
 *
 * react-native-anything-player does the DSP natively (downmix, resample to
 * {@link WAVE_POINTS}, level) on both platforms — including live streams on
 * iOS, where AVPlayer's own audio tap never runs. What is left here is pacing
 * and presentation: the measured window cadence (median, so decode bursts do
 * not twitch the trace), the delay until the window is heard, and the draw
 * gain.
 */

/**
 * Points in the oscilloscope line. Mirrors the web player's analyser window
 * (`AnalyserNode.frequencyBinCount` = 1024): the same number of audio samples
 * per pixel keeps the trace's horizontal proportions identical to the website.
 */
export const WAVE_POINTS = 1024;
const MIN_SAMPLE_INTERVAL_MS = 4;
const DEFAULT_NATIVE_INTERVAL_MS = 23;
const CADENCE_BUFFER = 8;
const MIN_NATIVE_INTERVAL_MS = 8;
const MAX_NATIVE_INTERVAL_MS = 80;
const MAX_OUTPUT_LATENCY_MS = 600;
const OUTPUT_LATENCY_SMOOTH = 0.85;
/** Bounds of the auto-calibrated residual delay correction. */
const SYNC_TRIM_LIMIT_MS = 150;
const SYNC_CALIBRATION_STEP = 0.08;
/** Draw gain: quiet passages are lifted toward this RMS (soft-clipped). */
const DRAW_TARGET_RMS = 0.42;
const DRAW_MAX_GAIN = 3;
const DRAW_GAIN_SMOOTH = 0.8;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class AudioSampler implements VisualizerSampler {
  private enabled = false;
  private foreground = true;
  private playing = false;
  private subscription: (() => void) | null = null;
  private readonly listeners = new Set<(window: VisualizerWindow) => void>();
  private previousWave: number[] | null = null;
  private drawGain = 1;
  private lastAt = -1;
  private intervalMs = DEFAULT_NATIVE_INTERVAL_MS;
  private readonly deltas: number[] = [];
  private outputLatencyMs = -1;
  private syncTrimMs = 0;
  private manualTrimMs = 0;

  constructor(private readonly transport: SamplingTransport) {}

  get isSupported(): boolean {
    return this.transport.isSamplingSupported;
  }

  get isActive(): boolean {
    return this.enabled && this.foreground && this.playing && this.isSupported;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.apply();
  }

  setForeground(foreground: boolean): void {
    this.foreground = foreground;
    this.apply();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.apply();
  }

  subscribeWindows(listener: (window: VisualizerWindow) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Feedback from the visualizer: the delay it actually applied for a window.
   * A persistent difference is residual error; move the correction toward it
   * (bounded and slow).
   */
  reportAppliedDelay(appliedMs: number): void {
    if (!Number.isFinite(appliedMs)) return;
    const error = appliedMs - this.appliedDelayMs();
    if (Math.abs(error) < 4) return;
    this.syncTrimMs = Math.min(
      SYNC_TRIM_LIMIT_MS,
      Math.max(-SYNC_TRIM_LIMIT_MS, this.syncTrimMs + error * SYNC_CALIBRATION_STEP),
    );
  }

  /** Manual sync bias (ms); positive makes the trace later than the audio. */
  setSyncTrim(trimMs: number): void {
    this.manualTrimMs = Number.isFinite(trimMs) ? trimMs : 0;
  }

  dispose(): void {
    this.enabled = false;
    this.apply();
    this.listeners.clear();
  }

  /** Reconciles the native sampling gate with the flags (only acts on change). */
  private apply(): void {
    if (this.isActive === (this.subscription != null)) return;
    if (this.isActive) {
      this.subscription = this.transport.onSample((sample) => this.handle(sample));
      this.transport.setSamplingEnabled(true);
    } else {
      this.transport.setSamplingEnabled(false);
      this.subscription?.();
      this.subscription = null;
      this.previousWave = null;
    }
  }

  private handle(sample: AudioSample): void {
    if (!this.isActive || sample.waveform.length === 0) return;
    this.trackCadence(Date.now());
    this.trackLatency(sample.outputLatency);
    const target = sample.waveform;
    if (sample.level > 0.02) this.applyDrawGain(target, sample.level);
    const window: VisualizerWindow = {
      previousWave: this.previousWave ?? target,
      targetWave: target,
      nativeIntervalMs: this.intervalMs,
      level: sample.level,
      outputLatencyMs: this.appliedDelayMs(),
    };
    this.previousWave = target;
    this.listeners.forEach((listener) => listener(window));
  }

  private trackCadence(now: number): void {
    if (this.lastAt >= 0) {
      const delta = now - this.lastAt;
      if (delta >= MIN_SAMPLE_INTERVAL_MS) {
        this.deltas.push(delta);
        if (this.deltas.length > CADENCE_BUFFER) this.deltas.shift();
        this.intervalMs = Math.min(
          MAX_NATIVE_INTERVAL_MS,
          Math.max(MIN_NATIVE_INTERVAL_MS, median(this.deltas)),
        );
      }
    }
    this.lastAt = now;
  }

  private trackLatency(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    const measured = Math.min(MAX_OUTPUT_LATENCY_MS, Math.max(0, seconds * 1000));
    this.outputLatencyMs =
      this.outputLatencyMs < 0
        ? measured
        : this.outputLatencyMs * OUTPUT_LATENCY_SMOOTH + measured * (1 - OUTPUT_LATENCY_SMOOTH);
  }

  private appliedDelayMs(): number {
    return Math.max(0, Math.max(0, this.outputLatencyMs) + this.syncTrimMs + this.manualTrimMs);
  }

  /** Lifts quiet passages toward a readable trace (soft-clipped, in place). */
  private applyDrawGain(wave: number[], level: number): void {
    const wanted = Math.min(DRAW_MAX_GAIN, Math.max(1, DRAW_TARGET_RMS / level));
    this.drawGain = this.drawGain * DRAW_GAIN_SMOOTH + wanted * (1 - DRAW_GAIN_SMOOTH);
    for (let i = 0; i < wave.length; i++) wave[i] = Math.tanh(wave[i] * this.drawGain);
  }
}
