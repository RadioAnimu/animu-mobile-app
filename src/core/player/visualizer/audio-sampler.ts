import type { AudioSample } from "react-native-anything-player";
import type {
  SamplingTransport,
  VisualizerSampler,
  VisualizerWindow,
} from "@/core/player/visualizer/types";

/**
 * Oscilloscope sampler — turns the player's decoded-audio windows into the
 * windows the WebView visualizer reads as one continuous signal.
 *
 * react-native-anything-player does the DSP natively (downmix, resample to
 * {@link WAVE_POINTS}, level) on both platforms — including live streams on
 * iOS, where AVPlayer's own audio tap never runs. What is left here is pacing
 * and presentation: the window's PCM duration (the visualizer's read pace)
 * and measured cadence (median; its stand-in when a platform reports no
 * duration), the delay until the window is heard, and the draw gain.
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

  constructor(private readonly transport: SamplingTransport) {}

  get isSupported(): boolean {
    return this.transport.isSamplingSupported;
  }

  get isActive(): boolean {
    return this.gated && this.listeners.size > 0;
  }

  // Everything except whether anyone is listening: set by the owner's flags.
  private get gated(): boolean {
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
    // First listener (or the first back from zero) turns sampling on; the
    // final one turns it off, so native sampling only runs for a viewer.
    this.apply();
    return () => {
      this.listeners.delete(listener);
      this.apply();
    };
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
      windowMs: sample.duration > 0 ? sample.duration * 1000 : this.intervalMs,
      level: sample.level,
      outputLatencyMs: Math.max(0, this.outputLatencyMs),
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

  /** Lifts quiet passages toward a readable trace (soft-clipped, in place). */
  private applyDrawGain(wave: number[], level: number): void {
    const wanted = Math.min(DRAW_MAX_GAIN, Math.max(1, DRAW_TARGET_RMS / level));
    this.drawGain = this.drawGain * DRAW_GAIN_SMOOTH + wanted * (1 - DRAW_GAIN_SMOOTH);
    for (let i = 0; i < wave.length; i++) wave[i] = Math.tanh(wave[i] * this.drawGain);
  }
}
