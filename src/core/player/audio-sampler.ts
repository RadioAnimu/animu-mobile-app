import type { AudioSample } from "expo-audio";
import { downmixChannels, lerpWaveform, resampleWaveform, rms } from "./waveform";
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

/**
 * Points in the oscilloscope line. Mirrors the web player's analyser window
 * (`AnalyserNode.frequencyBinCount` = 1024): the same number of audio samples
 * per pixel keeps the trace's horizontal proportions identical to the website.
 */
const WAVE_POINTS = 1024;
/** Intervals shorter than this are not used to measure the native rate. */
const MIN_SAMPLE_INTERVAL_MS = 4;
/** Bounds for the measured native window interval (ms). */
const MIN_NATIVE_INTERVAL_MS = 8;
const MAX_NATIVE_INTERVAL_MS = 80;
/** Fallback native interval until two windows are measured. */
const DEFAULT_NATIVE_INTERVAL_MS = 16;

/**
 * Emission-loop tick (ms). The loop runs on a **recurring timer** rather than
 * `requestAnimationFrame`: React Native schedules a recurring timer's next
 * deadline natively, so it keeps cadence even when the JS thread is busy. A
 * self-re-scheduled rAF/`setTimeout` does not — under load the Choreographer
 * services it every *other* frame, which silently halves a 60 Hz display to
 * ~30 fps (measured on device: rAF/setTimeout ≈ 33 ms, recurring timer ≈
 * 16.7 ms). The loop still gates actual emission on the configured `hz`, so
 * this only removes the artificial ceiling.
 */
const LOOP_TICK_MS = 4;
/**
 * Gate tolerance (ms). Emission fires when the elapsed time since the last
 * frame is within this much of the target interval. It absorbs the
 * whole-millisecond rounding of `Date.now()` (e.g. 32 ms vs a 33.3 ms target)
 * without letting a lower rate slip onto the next tick.
 */
const EMIT_TOLERANCE_MS = 2;

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

  /** Emission-loop interval id — runs at the requested frame rate while active. */
  private loopId: number | null = null;
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
    if (this.isActive) {
      // Already sampling? Nothing to do: the loop reads `hz` live, so a rate
      // change just takes effect on the next frame. Resetting the trace or
      // re-toggling the native tap here used to freeze the visualizer (and
      // could flush the audio pipeline) every time the user moved the slider.
      if (this.transportSubscription) return;
      this.transportSubscription = this.transport.onSample((sample) =>
        this.handleSample(sample),
      );
      this.reset();
      this.transport.setSamplingEnabled(true);
      this.startLoop();
      return;
    }

    if (!this.transportSubscription) return;
    this.transport.setSamplingEnabled(false);
    this.transportSubscription();
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
    if (this.loopId !== null) return;
    this.lastEmitAt = 0;
    this.loopId = setInterval(() => {
      if (!this.isActive) {
        this.stopLoop();
        return;
      }
      const now = Date.now();
      // Read `hz` every tick (not once at start) so a rate change takes effect
      // immediately, without restarting the loop or resetting the trace.
      const interval = 1000 / Math.max(1, this.hz);
      if (
        this.lastEmitAt === 0 ||
        now - this.lastEmitAt >= interval - EMIT_TOLERANCE_MS
      ) {
        this.lastEmitAt = now;
        this.emitFrame(now);
      }
    }, LOOP_TICK_MS) as unknown as number;
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
    if (this.loopId !== null) {
      clearInterval(this.loopId);
      this.loopId = null;
    }
    this.displayedWave = null;
  }
}
