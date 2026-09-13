import type { AudioSample } from "expo-audio";

/**
 * Visualizer contracts shared by both platforms.
 *
 * Kept free of any DSP / native imports so the iOS bundle can reference the
 * types without pulling the oscilloscope implementation into its Hermes
 * bytecode. The real implementation lives in `audio-sampler.ts` and is wired
 * only by `visualizer.android.ts`; iOS uses `visualizer.ios.ts`.
 */

/** Render frame rate. `0` means the visualizer is off. */
export type VisualizerFps = 0 | 30 | 48 | 60;

/** One display-ready frame: a fixed-length oscilloscope line + loudness. */
export interface WaveformFrame {
  /** Oscilloscope line, normalized -1..1, fixed length. */
  wave: number[];
  /** Overall loudness, normalized 0..1. */
  level: number;
}

/**
 * The sampler surface used by the player core. Android's `AudioSampler`
 * implements it against the native PCM tap; iOS uses a no-op.
 */
export interface VisualizerSampler {
  /** Whether the platform can sample audio at all. */
  readonly isSupported: boolean;
  /** Whether sampling is currently running. */
  readonly isActive: boolean;
  /** Target frame rate (`0` disables). */
  setFps(fps: VisualizerFps): void;
  /** App visibility — sampling never runs in the background. */
  setForeground(foreground: boolean): void;
  /** Transport state — sampling never runs while paused. */
  setPlaying(playing: boolean): void;
  /** Subscribes to frames; returns an unsubscribe function. */
  subscribe(listener: (frame: WaveformFrame) => void): () => void;
  /** Stops sampling and drops listeners. One-way. */
  dispose(): void;
}

/** Minimum slice of `AudioTransport` the sampler depends on. */
export interface SamplingTransport {
  readonly isSamplingSupported: boolean;
  setSamplingEnabled(enabled: boolean): void;
  onSample(handler: (sample: AudioSample) => void): () => void;
}
