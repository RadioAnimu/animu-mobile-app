import { describe, expect, it, vi } from "vitest";
import type { AudioSample } from "@/core/player/ports";
import { AudioSampler } from "@/core/player/visualizer/audio-sampler";

/** Fake transport exposing the captured native sample handler. */
const makeTransport = (supported = true) => {
  let handler: ((sample: AudioSample) => void) | null = null;
  const transport = {
    isSamplingSupported: supported,
    setSamplingEnabled: vi.fn(),
    onSample: vi.fn((next: (sample: AudioSample) => void) => {
      handler = next;
      return () => {
        handler = null;
      };
    }),
  };
  return {
    transport,
    emit: (sample: AudioSample) => handler?.(sample),
    hasHandler: () => handler !== null,
  };
};

const sample = (frames: number[]): AudioSample => ({
  channels: [{ frames }],
  timestamp: 0,
});

const activeSampler = () => {
  const fake = makeTransport();
  const sampler = new AudioSampler(fake.transport);
  sampler.setEnabled(true);
  sampler.setPlaying(true);
  return { ...fake, sampler };
};

describe("AudioSampler gating", () => {
  it("is inactive while disabled", () => {
    const { transport, hasHandler } = makeTransport();
    const sampler = new AudioSampler(transport);
    sampler.setPlaying(true);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).not.toHaveBeenCalledWith(true);
    expect(hasHandler()).toBe(false);
  });

  it("is inactive until enabled, playing and supported", () => {
    const { transport } = makeTransport();
    const sampler = new AudioSampler(transport);

    expect(sampler.isActive).toBe(false);
    sampler.setEnabled(true);
    expect(sampler.isActive).toBe(false);
    sampler.setPlaying(true);
    expect(sampler.isActive).toBe(true);
    expect(transport.setSamplingEnabled).toHaveBeenCalledWith(true);
  });

  it("stops sampling when playback stops", () => {
    const { transport, sampler } = activeSampler();
    sampler.setPlaying(false);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).toHaveBeenLastCalledWith(false);
  });

  it("stops sampling when the app is backgrounded", () => {
    const { transport, sampler } = activeSampler();
    sampler.setForeground(false);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).toHaveBeenLastCalledWith(false);
  });

  it("never activates when the platform does not support sampling", () => {
    const { transport, hasHandler } = makeTransport(false);
    const sampler = new AudioSampler(transport);
    sampler.setEnabled(true);
    sampler.setPlaying(true);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).not.toHaveBeenCalledWith(true);
    expect(hasHandler()).toBe(false);
  });

  it("detaches the native handler when it becomes inactive", () => {
    const { sampler, hasHandler } = activeSampler();
    expect(hasHandler()).toBe(true);
    sampler.setPlaying(false);
    expect(hasHandler()).toBe(false);
  });

  it("does not re-toggle native sampling when re-enabled in place", () => {
    const { sampler, transport } = activeSampler();
    expect(transport.setSamplingEnabled).toHaveBeenCalledTimes(1);

    sampler.setEnabled(true);

    expect(transport.setSamplingEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("AudioSampler windows", () => {
  it("publishes one window per native sample with no emission loop", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(128).fill(0.5)));
    emit(sample(new Array(128).fill(-0.5)));

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("emits windows of the web player's point count", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(128).fill(0.5)));

    const window = listener.mock.calls[0][0];
    expect(window.targetWave).toHaveLength(1024);
  });

  it("interpolates from the previous window to the new one", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(128).fill(0)));
    emit(sample(new Array(128).fill(1)));

    const window = listener.mock.calls[1][0];
    expect(window.previousWave.every((v: number) => v === 0)).toBe(true);
    expect(window.targetWave.every((v: number) => v > 0.7)).toBe(true);
  });

  it("snaps to the target on the very first window", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(128).fill(0.5)));

    const window = listener.mock.calls[0][0];
    expect(window.previousWave).toBe(window.targetWave);
  });

  it("reuses two buffers across windows (no per-window allocation)", () => {
    const { sampler, emit } = activeSampler();
    const targets: number[][] = [];
    sampler.subscribeWindows((window) => targets.push(window.targetWave));

    for (let i = 0; i < 10; i++) {
      emit(sample(new Array(64).fill(0.1)));
    }

    expect(new Set(targets).size).toBe(2);
  });

  it("down-mixes stereo channels like the web analyser", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit({
      channels: [{ frames: [1, 1] }, { frames: [-1, -1] }],
      timestamp: 0,
    });

    const window = listener.mock.calls[0][0];
    expect(window.targetWave.every((value: number) => Math.abs(value) < 1e-6)).toBe(
      true,
    );
  });

  it("reports the measured interval between native windows", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(64).fill(0.1)));
    emit(sample(new Array(64).fill(0.1)));

    const window = listener.mock.calls[1][0];
    // Fake-timer clock: the two windows land ~0-1 ms apart, which clamps to
    // the minimum measured interval.
    expect(window.nativeIntervalMs).toBeGreaterThanOrEqual(8);
    expect(window.nativeIntervalMs).toBeLessThanOrEqual(80);
  });

  it("carries the measured output latency into the window", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit({
      channels: [{ frames: [0.5, 0.5] }],
      timestamp: 0,
      outputLatencySeconds: 0.12,
    });

    const window = listener.mock.calls[0][0];
    expect(window.outputLatencyMs).toBeGreaterThan(0);
    expect(window.outputLatencyMs).toBeLessThanOrEqual(600);
  });

  it("defaults output latency to zero when the tap cannot measure it", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(64).fill(0.1)));

    expect(listener.mock.calls[0][0].outputLatencyMs).toBe(0);
  });

  it("auto-trims the applied delay toward what the visualizer reports", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    const withLatency = (seconds: number) => ({
      channels: [{ frames: [0.3, 0.3] }],
      timestamp: 0,
      outputLatencySeconds: seconds,
    });

    emit(withLatency(0.1));
    const initial = listener.mock.calls[0][0].outputLatencyMs;
    expect(initial).toBeGreaterThan(0);

    // The visualizer applies 60 ms MORE than the native lead, repeatedly.
    for (let i = 0; i < 40; i++) {
      sampler.reportAppliedDelay(initial + 60);
      emit(withLatency(0.1));
    }

    const settled = listener.mock.calls[listener.mock.calls.length - 1][0];
    // The correction converges toward the reported excess but stays bounded.
    expect(settled.outputLatencyMs).toBeGreaterThan(initial);
    expect(settled.outputLatencyMs).toBeLessThanOrEqual(initial + 150);
  });

  it("amplifies quiet material to keep the trace strong", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    // RMS 0.2 square: AGC pushes the gain up over consecutive windows; the
    // drawn wave visibly strengthens without ever pinning at the edge.
    emit(sample(new Array(128).fill(0.2)));
    for (let i = 0; i < 5; i++) emit(sample(new Array(128).fill(0.2)));

    const first = listener.mock.calls[0][0].targetWave;
    const settled = listener.mock.calls[5][0].targetWave;
    expect(settled.every((v: number) => v > 0.3)).toBe(true);
    // Soft knee: nothing may pin against the canvas edge.
    expect(settled.every((v: number) => v < 1)).toBe(true);
    expect(Math.max(...settled)).toBeGreaterThan(Math.max(...first));
  });

  it("never amplifies silence", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(128).fill(0)));

    const window = listener.mock.calls[0][0];
    expect(window.targetWave.every((v: number) => v === 0)).toBe(true);
  });

  it("soft-limits loud passages instead of shaving them at the edge", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    // Full-scale window: the soft knee asymptotes just below the canvas
    // edge — strong, but nothing gets flat-topped at ±1.
    emit(sample(new Array(128).fill(1)));

    const window = listener.mock.calls[0][0];
    const values = window.targetWave;
    expect(values.every((v: number) => Math.abs(v) < 1)).toBe(true);
    expect(Math.max(...values)).toBeGreaterThan(0.6);
  });

  it("stops publishing once disabled", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(64).fill(0.1)));
    sampler.setPlaying(false);
    emit(sample(new Array(64).fill(0.1)));

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("AudioSampler disposal", () => {
  it("stops sampling, unsubscribes and clears listeners", () => {
    const { sampler, transport, emit, hasHandler } = activeSampler();
    const listener = vi.fn();
    sampler.subscribeWindows(listener);

    emit(sample(new Array(64).fill(0.1)));
    sampler.dispose();
    emit(sample(new Array(64).fill(0.1)));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(hasHandler()).toBe(false);
    expect(transport.setSamplingEnabled).toHaveBeenLastCalledWith(false);
  });
});
