import { describe, expect, it, vi } from "vitest";
import type { AudioSample } from "react-native-airwave";
import { AudioSampler } from "@/core/player/visualizer/audio-sampler";
import type { VisualizerWindow } from "@/core/player/visualizer/types";

const setup = () => {
  let handler: ((sample: AudioSample) => void) | null = null;
  const transport = {
    isSamplingSupported: true,
    setSamplingEnabled: vi.fn(),
    onSample: vi.fn((h: (sample: AudioSample) => void) => {
      handler = h;
      return () => {
        handler = null;
      };
    }),
  };
  const sampler = new AudioSampler(transport);
  const windows: VisualizerWindow[] = [];
  sampler.subscribeWindows((w) => windows.push(w));
  const sample = (over: Partial<AudioSample> = {}) =>
    handler?.({
      waveform: [0.1, -0.1, 0.2, -0.2],
      level: 0.3,
      duration: 0.023,
      outputLatency: 0.1,
      timestamp: Date.now(),
      ...over,
    });
  return { sampler, transport, windows, sample, active: () => handler != null };
};

describe("AudioSampler (react-native-airwave windows)", () => {
  it("samples only while enabled, foregrounded and playing", () => {
    const t = setup();
    t.sampler.setEnabled(true);
    expect(t.active()).toBe(false);
    t.sampler.setPlaying(true);
    expect(t.active()).toBe(true);
    expect(t.transport.setSamplingEnabled).toHaveBeenLastCalledWith(true);
    t.sampler.setForeground(false);
    expect(t.active()).toBe(false);
    expect(t.transport.setSamplingEnabled).toHaveBeenLastCalledWith(false);
    t.sampler.setForeground(true);
    t.sampler.setEnabled(false);
    expect(t.active()).toBe(false);
    // Repeated flags do not re-subscribe.
    t.sampler.setEnabled(false);
    expect(t.transport.onSample).toHaveBeenCalledTimes(2);
  });

  it("publishes interpolation pairs with the delay until heard", () => {
    const t = setup();
    t.sampler.setEnabled(true);
    t.sampler.setPlaying(true);
    t.sample({ waveform: [0.5, -0.5], level: 0.5, outputLatency: 0.12 });
    t.sample({ waveform: [0.25, -0.25], level: 0.5, outputLatency: 0.12 });
    expect(t.windows).toHaveLength(2);
    const [first, second] = t.windows;
    expect(first.previousWave).toBe(first.targetWave);
    expect(second.previousWave).toBe(first.targetWave);
    expect(second.outputLatencyMs).toBeCloseTo(120, 5);
    expect(second.level).toBe(0.5);
  });

  it("smooths latency, applies manual and calibrated trims", () => {
    const t = setup();
    t.sampler.setEnabled(true);
    t.sampler.setPlaying(true);
    t.sample({ outputLatency: 0.2 });
    t.sample({ outputLatency: 0 });
    // 200 → eased toward 0, not jumping.
    expect(t.windows[1].outputLatencyMs).toBeCloseTo(170, 5);
    t.sampler.setSyncTrim(50);
    t.sample({ outputLatency: 0 });
    expect(t.windows[2].outputLatencyMs).toBeCloseTo(144.5 + 50, 5);
    // The visualizer applied more than asked: the residual nudges later windows.
    t.sampler.reportAppliedDelay(400);
    t.sample({ outputLatency: 0 });
    expect(t.windows[3].outputLatencyMs).toBeGreaterThan(122.825 + 50);
  });

  it("lifts quiet passages and soft-clips loud ones", () => {
    const t = setup();
    t.sampler.setEnabled(true);
    t.sampler.setPlaying(true);
    for (let i = 0; i < 20; i++) t.sample({ waveform: [0.05, -0.05], level: 0.05 });
    const quiet = t.windows.at(-1)!.targetWave[0];
    expect(quiet).toBeGreaterThan(0.05);
    expect(quiet).toBeLessThan(1);
  });

  it("drops windows once disposed", () => {
    const t = setup();
    t.sampler.setEnabled(true);
    t.sampler.setPlaying(true);
    t.sampler.dispose();
    t.sample();
    expect(t.windows).toHaveLength(0);
  });
});
