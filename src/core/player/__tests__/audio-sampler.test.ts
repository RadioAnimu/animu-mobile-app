import { describe, expect, it, vi } from "vitest";
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

const activeSampler = (fps: 0 | 30 | 48 | 60 = 60) => {
  const fake = makeTransport();
  const sampler = new AudioSampler(fake.transport);
  sampler.setFps(fps);
  sampler.setPlaying(true);
  return { ...fake, sampler };
};

describe("AudioSampler gating", () => {
  it("is inactive while the frame rate is zero", () => {
    const { transport } = makeTransport();
    const sampler = new AudioSampler(transport);
    sampler.setFps(0);
    sampler.setPlaying(true);

    expect(sampler.isActive).toBe(false);
    expect(transport.setSamplingEnabled).not.toHaveBeenCalledWith(true);
    expect(transport.onSample).not.toHaveBeenCalled();
  });

  it("is inactive until enabled, playing and supported", () => {
    const { transport } = makeTransport();
    const sampler = new AudioSampler(transport);

    expect(sampler.isActive).toBe(false);
    sampler.setFps(60);
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
    sampler.setFps(60);
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
  it("emits a fixed-length waveform and level", () => {
    const { sampler, emit } = activeSampler();
    const frames: number[][] = [];
    sampler.subscribe((frame) => frames.push(frame.wave));

    emit(sample(new Array(128).fill(0.5)));

    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(128);
  });

  it("stops notifying unsubscribed listeners", () => {
    const { sampler, emit } = activeSampler();
    const listener = vi.fn();
    const unsubscribe = sampler.subscribe(listener);

    emit(sample(new Array(64).fill(0.1)));
    unsubscribe();
    emit(sample(new Array(64).fill(0.1)));

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("AudioSampler frame-rate decimation", () => {
  it("passes every native frame through at 60 fps", () => {
    const { sampler, emit } = activeSampler(60);
    const listener = vi.fn();
    sampler.subscribe(listener);

    for (let i = 0; i < 5; i++) emit(sample(new Array(64).fill(0.1)));

    expect(listener).toHaveBeenCalledTimes(5);
  });

  it("drops exactly one in five frames at 48 fps", () => {
    const { sampler, emit } = activeSampler(48);
    const listener = vi.fn();
    sampler.subscribe(listener);

    for (let i = 0; i < 5; i++) emit(sample(new Array(64).fill(0.1)));

    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe("AudioSampler disposal", () => {
  it("stops sampling and clears listeners", () => {
    const { sampler, transport, emit } = activeSampler();
    const listener = vi.fn();
    sampler.subscribe(listener);

    sampler.dispose();
    emit(sample(new Array(64).fill(0.1)));

    expect(listener).not.toHaveBeenCalled();
    expect(transport.setSamplingEnabled).toHaveBeenLastCalledWith(false);
  });
});
