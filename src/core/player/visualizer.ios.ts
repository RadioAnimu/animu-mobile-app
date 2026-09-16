import { AudioSampler } from "./audio-sampler";
import type { SamplingTransport, VisualizerSampler } from "./visualizer.types";

/**
 * iOS sampler factory.
 *
 * expo-audio 57 ships the whole iOS sampling chain out of the box: an
 * MTAudioProcessingTap (`AudioTapProcessor`) attached to the AVPlayer item,
 * decoding windows emitted through the shared `audioSampleUpdate` bridge —
 * the same surface the Android patch implements. The old assumption that a
 * live `AVPlayer` stream cannot be tapped no longer holds at this SDK
 * version, so iOS consumes the exact same `AudioSampler` pipeline as
 * Android: down-mix → resample → publish raw windows; the WebView engine
 * does all the per-frame work.
 */
export function createVisualizerSampler(
  transport: SamplingTransport,
): VisualizerSampler {
  return new AudioSampler(transport);
}
