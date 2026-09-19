import type {
  SamplingTransport,
  VisualizerSampler,
  VisualizerWindow,
} from "@/core/player/visualizer.types";

/**
 * iOS sampler factory — no-op.
 *
 * expo-audio 57 ships an `MTAudioProcessingTap` sampling hook that installs
 * fine on a live `AVPlayer` item (`installTap` succeeds) but its render
 * callback **never fires for indefinite HTTP audio** (verified natively:
 * the tap attached, then `tapProcess` was never invoked). Until expo-audio
 * changes how the feed leaves the player, iOS cannot tap the decoded
 * stream, so the sampler stays a stub and the entire oscilloscope
 * implementation stays out of the iOS bundle (type-only references here —
 * the superset `VisualizerWindow` type keeps the shared pipeline ready).
 */
class NoopVisualizerSampler implements VisualizerSampler {
  readonly isSupported = false;
  readonly isActive = false;

  setEnabled(_enabled: boolean): void {}
  setForeground(_foreground: boolean): void {}
  setPlaying(_playing: boolean): void {}
  subscribeWindows(_listener: (window: VisualizerWindow) => void): () => void {
    return () => {};
  }
  dispose(): void {}
}

export function createVisualizerSampler(
  _transport: SamplingTransport,
): VisualizerSampler {
  return new NoopVisualizerSampler();
}
