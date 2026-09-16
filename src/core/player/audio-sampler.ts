import type { AudioSample } from "expo-audio";
import { downmixChannels, resampleWaveformInto, rms } from "./waveform";
import type {
  SamplingTransport,
  VisualizerSampler,
  VisualizerWindow,
} from "./visualizer.types";

/**
 * Oscilloscope sampler — turns the native player's decoded-PCM events into
 * the raw waveform windows the visualizer draws from, with **zero per-frame
 * work on the RN side**.
 *
 * Android-only. Owned by `PlayerService` and fed by `AudioTransport`.
 *
 * The native PCM tap is bound to the ExoPlayer audio-buffer cadence, which
 * can be as slow as ~40 Hz (stream/sample-rate dependent), and unlike the
 * browser its window does not advance between taps. So each new window is
 * down-mixed to mono, resampled to the display point count, and published
 * once with the measured window interval — the consumer (the WebView's
 * canvas) interpolates between the last two windows at the display's own
 * rAF rate, exactly like the web player's continuously advancing
 * `AnalyserNode`.
 *
 * There is no emission loop, no rate cap and no frame building here any
 * more: this module publishes ~40 small windows per second and nothing
 * else. All per-frame work lives in the visualizer's own render loop.
 */

/**
 * Points in the oscilloscope line. Mirrors the web player's analyser window
 * (`AnalyserNode.frequencyBinCount` = 1024): the same number of audio samples
 * per pixel keeps the trace's horizontal proportions identical to the website.
 */
const WAVE_POINTS = 1024;
/** Intervals shorter than this are not used to measure the native rate. */
const MIN_SAMPLE_INTERVAL_MS = 4;
/** Fallback native interval until two windows are measured. */
const DEFAULT_NATIVE_INTERVAL_MS = 16;
/**
 * Cadence filter depth (windows). The native tap fires from ExoPlayer's
 * audio-buffer cadence, which arrives in bursts (decode batches, GC-drawn
 * CPU ticks), so the *last* inter-window delta wobbles frame to frame and
 * the interpolated trace twitches. The interpolation runs on the
 * MEDIAN of the last few deltas — one sorted copy of a tiny array per
 * window, near-free — which is what keeps the pace smooth between bursts.
 */
const CADENCE_BUFFER = 8;
const MIN_NATIVE_INTERVAL_MS = 8;
const MAX_NATIVE_INTERVAL_MS = 80;

/**
 * Median of the recent inter-window deltas, clamped to the plausible cadence
 * band — one sorted copy per window is negligible (~8 numbers) and it is
 * what keeps the interpolated pace smooth between ExoPlayer's bursty
 * decode batches.
 */
function medianCadence(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.min(MAX_NATIVE_INTERVAL_MS, Math.max(MIN_NATIVE_INTERVAL_MS, median));
}

/**
 * Draw-signal normalization (AGC + soft-knee limiter).
 *
 * The web player's analyser reads post-`volume` audio, so its trace thins
 * out on quiet passages and the oscilloscope feels "slow" at low program
 * levels. Here the *drawn* signal (never the audible player volume) is
 * amplified toward a strong constant RMS, so the trace vibrates at
 * ~full height on every section of the program.
 *
 * - `DRAW_TARGET_RMS` — the RMS the trace visually targets. Peaks stay
 *   inside the canvas via the soft knee, so loud bursts don't get shaved
 *   off at the canvas edge like a hard clamp would.
 * - `DRAW_MAX_GAIN` — hard ceiling so quiet bursts are never overdriven.
 * - the measured gain is IIR-smoothed so the trace doesn't pump between
 *   windows.
 */
const DRAW_TARGET_RMS = 0.42;
const DRAW_MAX_GAIN = 3;
const DRAW_GAIN_SMOOTH = 0.8;

export class AudioSampler implements VisualizerSampler {
  private enabled = false;
  private foreground = true;
  private playing = false;

  private transportSubscription: (() => void) | null = null;
  /** Subscribers receive every raw native window (not per-frame frames). */
  private readonly windowListeners = new Set<
    (window: VisualizerWindow) => void
  >();

  /**
   * Reusable frame buffers. Every window is a fixed 1024-point array, so the
   * two latest windows live in two long-lived buffers — zero allocation in
   * the steady state.
   */
  private readonly waveBufs: [number[], number[]] = [[], []];
  /** Index of the buffer that currently holds the newest target window. */
  private targetIndex = 0;
  /** Whether at least one window has been published (powers interpolation). */
  private hadWindow = false;
  private targetLevel = 0;
  /** Smoothed draw-signal gain (see the AGC constants above). */
  private drawGain = 1;
  private nativeAt = -1;
  private nativeIntervalMs = DEFAULT_NATIVE_INTERVAL_MS;
  /** Recent inter-window deltas for the median cadence filter. */
  private readonly nativeDeltas: number[] = [];

  constructor(private readonly transport: SamplingTransport) {}

  get isSupported(): boolean {
    return this.transport.isSamplingSupported;
  }

  get isActive(): boolean {
    return this.enabled && this.foreground && this.playing && this.isSupported;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
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

  /** Subscribes to raw waveform windows; returns an unsubscribe function. */
  subscribeWindows(listener: (window: VisualizerWindow) => void): () => void {
    this.windowListeners.add(listener);
    return () => {
      this.windowListeners.delete(listener);
    };
  }

  /** Stops sampling and drops listeners. One-way. */
  dispose(): void {
    this.enabled = false;
    this.playing = false;
    this.apply();
    this.windowListeners.clear();
  }

  /** Reconciles the native sampling gate with the current flags. */
  private apply(): void {
    if (this.isActive) {
      if (this.transportSubscription) return;
      this.transportSubscription = this.transport.onSample((sample) =>
        this.handleSample(sample),
      );
      this.transport.setSamplingEnabled(true);
      return;
    }

    if (!this.transportSubscription) return;
    this.transport.setSamplingEnabled(false);
    this.transportSubscription();
    this.transportSubscription = null;
  }

  /** A new native PCM window arrived: down-mix, resample, amplify, publish. */
  private handleSample(sample: AudioSample): void {
    if (!this.isActive) return;
    // Mirror the web player's `AnalyserNode`, which analyses a mono down-mix
    // of the stream. Tapping channel 0 alone makes the trace taller than the
    // website whenever the left/right channels differ.
    const frames = downmixChannels(
      (sample.channels ?? []).map((channel) => channel.frames),
    );
    if (frames.length === 0) return;

    const now = Date.now();
    if (this.nativeAt >= 0) {
      const delta = now - this.nativeAt;
      if (delta >= MIN_SAMPLE_INTERVAL_MS) {
        this.nativeDeltas.push(delta);
        if (this.nativeDeltas.length > CADENCE_BUFFER) this.nativeDeltas.shift();
        this.nativeIntervalMs = medianCadence(this.nativeDeltas);
      }
    }
    this.nativeAt = now;

    // Publish the previous window + the new one; the visualizer interpolates
    // between them across `nativeIntervalMs` at its own rAF rate.
    const nextIndex = 1 - this.targetIndex;
    const target = resampleWaveformInto(
      frames,
      WAVE_POINTS,
      this.waveBufs[nextIndex],
    );
    const previous = this.hadWindow ? this.waveBufs[this.targetIndex] : target;
    this.targetIndex = nextIndex;
    this.hadWindow = true;
    this.targetLevel = rms(frames);

    // AGC on the *drawn* signal only — the player's audible volume is
    // untouched. The limiter is a **soft knee** (`tanh`), not a hard clamp:
    // the hard ±1 clamp flat-topped loud peaks, which visually shaved the
    // trace's tops off at the canvas edge. `tanh` amplifies small values
    // like a linear gain and asymptotically compresses peaks just below
    // full scale — strong, but never shaved.
    if (this.targetLevel > 0.02) {
      const wanted = Math.min(
        DRAW_MAX_GAIN,
        Math.max(1, DRAW_TARGET_RMS / this.targetLevel),
      );
      this.drawGain = this.drawGain * DRAW_GAIN_SMOOTH + wanted * (1 - DRAW_GAIN_SMOOTH);
      const gain = this.drawGain;
      for (let i = 0; i < target.length; i++) {
        target[i] = Math.tanh(target[i] * gain);
      }
    }

    const payload: VisualizerWindow = {
      previousWave: previous,
      targetWave: target,
      nativeIntervalMs: this.nativeIntervalMs,
      level: this.targetLevel,
    };
    this.windowListeners.forEach((listener) => listener(payload));
  }
}
