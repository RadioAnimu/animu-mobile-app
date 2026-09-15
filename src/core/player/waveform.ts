/**
 * Pure DSP helpers for the audio visualizer.
 *
 * Kept free of React and native imports so they are cheap to unit-test and
 * safe to run on every audio frame. The native side hands us decoded PCM
 * frames (normalized to -1..1); everything here is presentation shaping.
 *
 * This module is only reachable from `visualizer.android.ts`, so none of it
 * is bundled into the iOS app.
 */

/** Clamp a value into the normalized [-1, 1] sample range. */
const clampSample = (value: number): number =>
  value < -1 ? -1 : value > 1 ? 1 : value;

/** Clamp a value into the normalized [0, 1] display range. */
const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

/**
 * Down-mixes native per-channel PCM to mono.
 *
 * The web player's `AnalyserNode` analyses a mono down-mix of the stream, so
 * averaging the channels here keeps the oscilloscope's vertical amplitude
 * identical to the website. Sampling a single channel (e.g. the left one)
 * overstates the trace for stereo material, where the channels differ.
 *
 * Returns the sole channel unchanged when the signal is already mono.
 */
export function downmixChannels(channels: number[][]): number[] {
  const loudest = channels.filter((channel) => channel.length > 0);
  if (loudest.length === 0) return [];
  if (loudest.length === 1) return loudest[0];

  const length = Math.min(...loudest.map((channel) => channel.length));
  const out = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of loudest) {
      sum += channel[i] ?? 0;
    }
    out[i] = sum / loudest.length;
  }
  return out;
}

/**
 * Down-samples a PCM window to a fixed number of points for an oscilloscope.
 *
 * Picks evenly spaced samples (rather than peak buckets) so the line keeps the
 * signal's shape. Returns a zeroed array when there is no signal yet.
 */
export function resampleWaveform(frames: number[], points: number): number[] {
  const count = Math.max(0, Math.floor(points));
  if (count === 0) return [];
  if (frames.length === 0) return new Array<number>(count).fill(0);

  const out = new Array<number>(count);
  const step = frames.length / count;
  for (let i = 0; i < count; i++) {
    const index = Math.min(frames.length - 1, Math.floor(i * step));
    out[i] = clampSample(frames[index] ?? 0);
  }
  return out;
}

/**
 * Linear interpolation between two frames. Used to render intermediate frames
 * between the (slower) native PCM windows so motion matches the display rate.
 * `t` runs 0 (previous) → 1 (next).
 */
export function lerpWaveform(
  previous: number[] | null,
  next: number[],
  t: number,
): number[] {
  if (!previous || previous.length !== next.length) {
    return next;
  }
  const amount = clamp01(t);
  const out = new Array<number>(next.length);
  for (let i = 0; i < next.length; i++) {
    out[i] = previous[i] + (next[i] - previous[i]) * amount;
  }
  return out;
}

/** Root-mean-square loudness of a PCM window, normalized to [0, 1]. */
export function rms(frames: number[]): number {
  if (frames.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frames.length; i++) {
    sum += frames[i] * frames[i];
  }
  return clamp01(Math.sqrt(sum / frames.length));
}
