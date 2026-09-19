import { AudioSampler } from "@/core/player/audio-sampler";
import type { SamplingTransport, VisualizerSampler } from "@/core/player/visualizer.types";

/**
 * Android sampler factory. Kept in a platform file so the oscilloscope DSP
 * (`AudioSampler` + `waveform`) is only bundled on Android.
 */
export function createVisualizerSampler(
  transport: SamplingTransport,
): VisualizerSampler {
  return new AudioSampler(transport);
}
