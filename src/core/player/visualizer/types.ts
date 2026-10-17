import type { AudioSample } from "react-native-anything-player";

/**
 * Visualizer contracts shared by both platforms.
 *
 * Kept free of any DSP / native imports. Both platforms use the same
 * implementation (`audio-sampler.ts`), fed by react-native-anything-player.
 */

/**
 * One raw sampler window pair, published once per native PCM window.
 * Consecutive windows are consecutive slices of the decoded stream; the
 * visualizer joins them into one signal and reads it on its own clock at
 * its display rate, like the web player's analyser advancing on the audio
 * thread.
 */
export interface VisualizerWindow {
  /** Ending window of the interpolation (equal to `targetWave` at first). */
  previousWave: number[];
  /** Newest window: the interpolation's destination. */
  targetWave: number[];
  /** Measured milliseconds between the last two native windows. */
  nativeIntervalMs: number;
  /** Milliseconds of audio this window covers (its PCM duration). */
  windowMs: number;
  /** Overall loudness, normalized 0..1. */
  level: number;
  /**
   * How many milliseconds the decoded window leads the audible audio on the
   * device (output-buffer + hardware latency). The visualizer delays its
   * trace by this much so the scope matches what the listener hears rather
   * than the freshly decoded PCM. 0 when the platform cannot measure it.
   */
  outputLatencyMs: number;
}

/**
 * The sampler surface used by the player core (`AudioSampler`).
 */
export interface VisualizerSampler {
  /** Whether the platform can sample audio at all. */
  readonly isSupported: boolean;
  /** Whether sampling is currently running. */
  readonly isActive: boolean;
  /** On/off. The render pace is decided by the consumer's own vsync loop. */
  setEnabled(enabled: boolean): void;
  /** App visibility — sampling never runs in the background. */
  setForeground(foreground: boolean): void;
  /** Transport state — sampling never runs while paused. */
  setPlaying(playing: boolean): void;
  /** Subscribes to raw waveform windows; returns an unsubscribe function. */
  subscribeWindows(listener: (window: VisualizerWindow) => void): () => void;
  /**
   * Reports back the delay (ms) the visualizer actually applied for a window,
   * so the sampler can auto-calibrate its residual sync offset. Optional: a
   * visualizer that applies the window's `outputLatencyMs` verbatim need not
   * call it.
   */
  reportAppliedDelay?(appliedMs: number): void;
  /** Sets a manual sync bias (ms); positive makes the trace later. */
  setSyncTrim?(trimMs: number): void;
  /** Stops sampling and drops listeners. One-way. */
  dispose(): void;
}

/** The player's decoded-audio feed (see `player-factory.ts`). */
export interface SamplingTransport {
  readonly isSamplingSupported: boolean;
  setSamplingEnabled(enabled: boolean): void;
  onSample(handler: (sample: AudioSample) => void): () => void;
}
