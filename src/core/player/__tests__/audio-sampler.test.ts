import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioSample } from "expo-audio";
import { AudioSampler } from "../audio-sampler";

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

const activeSampler = (hz = 60) => {
  const fake = makeTransport();
  const sampler = new AudioSampler(fake.transport);
  sampler.setHz(hz);
  sampler.setPlaying(true);
  return { ...fake, sampler };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AudioSampler gating", () => {
  it("is inactive while the rate is zero", () => {
    const { transport } = makeTransport();
    const sampler = new AudioSampler(transport);
    sampler.setHz(0);
    sampler.setPlaying(true);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).not.toHaveBeenCalledWith(true);
    expect(transport.onSample).not.toHaveBeenCalled();
  });

  it("is inactive until enabled, playing and supported", () => {
    const { transport } = makeTransport();
    const sampler = new AudioSampler(transport);

    expect(sampler.isActive).toBe(false);
    sampler.setHz(60);
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
    const { transport } = makeTransport(false);
    const sampler = new AudioSampler(transport);
    sampler.setHz(60);
    sampler.setPlaying(true);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).not.toHaveBeenCalledWith(true);
    expect(transport.onSample).not.toHaveBeenCalled();
  });

  it("detaches the native handler when it becomes inactive", () => {
    const { sampler, hasHandler } = activeSampler();
    expect(hasHandler()).toBe(true);
    sampler.setPlaying(false);
    expect(hasHandler()).toBe(false);
  });
});

describe("AudioSampler frames", () => {
  it("emits interpolated frames of the configured length", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribe(listener);

    emit(sample(new Array(128).fill(0.5)));
    vi.advanceTimersByTime(20);

    expect(listener).toHaveBeenCalled();
    const frame = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(frame.wave).toHaveLength(1024);
  });

  it("does not emit before the first native window arrives", () => {
    const { sampler } = activeSampler();
    const listener = vi.fn();
    sampler.subscribe(listener);

    vi.advanceTimersByTime(200);

    expect(listener).not.toHaveBeenCalled();
  });

  it("down-mixes stereo channels like the web analyser", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribe(listener);

    emit({
      channels: [{ frames: [1, 1] }, { frames: [-1, -1] }],
      timestamp: 0,
    });
    vi.advanceTimersByTime(20);

    const frame = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(
      frame.wave.every((value: number) => Math.abs(value) < 1e-6),
    ).toBe(true);
  });

  it("changes rate in place without re-toggling native sampling", () => {
    const { sampler, transport } = activeSampler(60);
    expect(transport.setSamplingEnabled).toHaveBeenCalledTimes(1);

    sampler.setHz(30);
    sampler.setHz(90);

    expect(transport.setSamplingEnabled).toHaveBeenCalledTimes(1);
  });

  it("applies a rate change without restarting the loop", () => {
    const { sampler, emit } = activeSampler(30);
    const listener = vi.fn();
    sampler.subscribe(listener);
    emit(sample(new Array(64).fill(0.1)));
    vi.advanceTimersByTime(1000);
    const low = listener.mock.calls.length;

    sampler.setHz(120);
    emit(sample(new Array(64).fill(0.1)));
    vi.advanceTimersByTime(1000);
    const high = listener.mock.calls.length - low;

    expect(high).toBeGreaterThan(low);
  });

  it("emits more frames at a higher rate", () => {
    const low = activeSampler(30);
    const lowListener = vi.fn();
    low.sampler.subscribe(lowListener);
    low.emit(sample(new Array(64).fill(0.1)));
    vi.advanceTimersByTime(1000);

    const high = activeSampler(120);
    const highListener = vi.fn();
    high.sampler.subscribe(highListener);
    high.emit(sample(new Array(64).fill(0.1)));
    vi.advanceTimersByTime(1000);

    expect(highListener.mock.calls.length).toBeGreaterThan(
      lowListener.mock.calls.length,
    );
  });
});

describe("AudioSampler disposal", () => {
  it("stops sampling, stops the loop and clears listeners", () => {
    const { sampler, transport, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribe(listener);

    emit(sample(new Array(64).fill(0.1)));
    sampler.dispose();
    vi.advanceTimersByTime(200);

    expect(listener).not.toHaveBeenCalled();
    expect(transport.setSamplingEnabled).toHaveBeenLastCalledWith(false);
  });
});
