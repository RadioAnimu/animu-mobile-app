import type {
  SamplingTransport,
  VisualizerFps,
  VisualizerSampler,
  WaveformFrame,
} from "./visualizer.types";

/**
 * iOS sampler stub.
 *
 * iOS cannot sample a live `AVPlayer` stream (`AVAudioMix` is not applied to
 * indefinite streams), so the visualizer ships Android-only for now. This
 * no-op keeps the player core platform-agnostic while ensuring the entire
 * oscilloscope implementation is absent from the iOS bundle.
 */
class NoopVisualizerSampler implements VisualizerSampler {
  readonly isSupported = false;
  readonly isActive = false;

  setFps(_fps: VisualizerFps): void {}
  setForeground(_foreground: boolean): void {}
  setPlaying(_playing: boolean): void {}
  subscribe(_listener: (frame: WaveformFrame) => void): () => void {
    return () => {};
  }
  dispose(): void {}
}

export function createVisualizerSampler(
  _transport: SamplingTransport,
): VisualizerSampler {
  return new NoopVisualizerSampler();
}
