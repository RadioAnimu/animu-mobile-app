import type { AudioSample } from "expo-audio";
import { lerpWaveform, resampleWaveform, rms } from "./waveform";
import type {
  SamplingTransport,
  VisualizerHz,
  VisualizerSampler,
  WaveformFrame,
} from "./visualizer.types";

/**
 * Oscilloscope sampler — turns the native player's decoded-PCM events into
 * display-ready waveform frames at a steady target frame rate.
 *
 * Android-only. Owned by `PlayerService` and fed by `AudioTransport`.
 *
 * The native PCM tap is bound to the ExoPlayer audio-buffer cadence, which can
 * be as slow as ~40 Hz (stream/sample-rate dependent) — not enough for a fluid
 * 60 hz trace. So the sampler keeps the last two native windows and emits
 * interpolated frames on a timer at the requested hz. This mirrors what the
 * browser's `AnalyserNode` + `requestAnimationFrame` does (a continuously
 * advancing window) and keeps 30/48/60 visually distinct.
 *
 * Deliberately not a React store: frames must not re-render the app tree. The
 * visualizer component subscribes imperatively. The module is excluded from the
 * iOS bundle by the `visualizer.ios.ts` stub.
 */

/** Points in the oscilloscope line. */
const WAVE_POINTS = 256;
/** Intervals shorter than this are not used to measure the native rate. */
const MIN_SAMPLE_INTERVAL_MS = 4;
/** Bounds for the measured native window interval (ms). */
const MIN_NATIVE_INTERVAL_MS = 8;
const MAX_NATIVE_INTERVAL_MS = 80;
/** Fallback native interval until two windows are measured. */
const DEFAULT_NATIVE_INTERVAL_MS = 16;

/** Frame scheduler: `requestAnimationFrame` where available, else a timer. */
type FrameHandle = { kind: "raf" | "timeout"; id: number };
const requestFrame = (fn: () => void): FrameHandle => {
  if (typeof requestAnimationFrame === "function") {
    return { kind: "raf", id: requestAnimationFrame(fn) };
  }
  return { kind: "timeout", id: setTimeout(fn, 16) as unknown as number };
};
const cancelFrame = (handle: FrameHandle): void => {
  if (handle.kind === "raf") {
    cancelAnimationFrame(handle.id);
  } else {
    clearTimeout(handle.id);
  }
};

export class AudioSampler implements VisualizerSampler {
  private hz: VisualizerHz = 0;
  private foreground = true;
  private playing = false;

  private transportSubscription: (() => void) | null = null;
  private readonly listeners = new Set<(frame: WaveformFrame) => void>();

  /** Interpolation endpoints and cadence. */
  private previousWave: number[] | null = null;
  private targetWave: number[] | null = null;
  private targetLevel = 0;
  private displayedWave: number[] | null = null;
  /** Timestamp of the last native window; -1 until the first arrives. */
  private nativeAt = -1;
  private nativeIntervalMs = DEFAULT_NATIVE_INTERVAL_MS;

  /** Display loop handle — runs at the requested frame rate while active. */
  private frameHandle: FrameHandle | null = null;
  private lastEmitAt = 0;

  constructor(private readonly transport: SamplingTransport) {}

  get isSupported(): boolean {
    return this.transport.isSamplingSupported;
  }

  get isActive(): boolean {
    return this.hz > 0 && this.foreground && this.playing && this.isSupported;
  }

  setHz(hz: VisualizerHz): void {
    if (this.hz === hz) return;
    this.hz = hz;
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
    this.hz = 0;
    this.playing = false;
    this.apply();
    this.listeners.clear();
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
      this.reset();
      this.transport.setSamplingEnabled(true);
      this.startLoop();
      return;
    }

    this.transport.setSamplingEnabled(false);
    this.transportSubscription?.();
    this.transportSubscription = null;
    this.stopLoop();
  }

  private reset(): void {
    this.previousWave = null;
    this.targetWave = null;
    this.targetLevel = 0;
    this.displayedWave = null;
    this.nativeAt = -1;
    this.nativeIntervalMs = DEFAULT_NATIVE_INTERVAL_MS;
  }

  /** A new native PCM window arrived: retarget the interpolation. */
  private handleSample(sample: AudioSample): void {
    if (!this.isActive) return;
    const frames = sample.channels?.[0]?.frames ?? [];
    if (frames.length === 0) return;

    const now = Date.now();
    if (this.nativeAt >= 0) {
      const delta = now - this.nativeAt;
      if (delta >= MIN_SAMPLE_INTERVAL_MS) {
        this.nativeIntervalMs = Math.min(
          MAX_NATIVE_INTERVAL_MS,
          Math.max(MIN_NATIVE_INTERVAL_MS, delta),
        );
      }
    }
    this.nativeAt = now;

    // Interpolate from wherever the trace currently is to the new window.
    this.previousWave = this.displayedWave ?? this.targetWave;
    this.targetWave = resampleWaveform(frames, WAVE_POINTS);
    this.targetLevel = rms(frames);
  }

  private startLoop(): void {
    if (this.frameHandle) return;
    this.lastEmitAt = 0;
    const loop = () => {
      if (!this.isActive) {
        this.frameHandle = null;
        return;
      }
      const now = Date.now();
      const interval = 1000 / Math.max(1, this.hz);
      if (this.lastEmitAt === 0 || now - this.lastEmitAt >= interval - 1) {
        this.lastEmitAt = now;
        this.emitFrame(now);
      }
      this.frameHandle = requestFrame(loop);
    };
    this.frameHandle = requestFrame(loop);
  }

  private emitFrame(now: number): void {
    // Hold until the first real window arrives so the visualizer doesn't
    // animate on empty data.
    if (!this.targetWave) return;
    const elapsed = this.nativeAt >= 0 ? now - this.nativeAt : 0;
    const t = Math.min(1, elapsed / this.nativeIntervalMs);
    const wave = lerpWaveform(this.previousWave, this.targetWave, t);
    this.displayedWave = wave;
    const frame: WaveformFrame = { wave, level: this.targetLevel };
    this.listeners.forEach((listener) => listener(frame));
  }

  private stopLoop(): void {
    if (this.frameHandle) {
      cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.displayedWave = null;
  }
}
