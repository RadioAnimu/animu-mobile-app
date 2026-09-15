import { describe, expect, it } from "vitest";
import {
  downmixChannels,
  lerpWaveform,
  resampleWaveform,
  rms,
} from "../waveform";

describe("downmixChannels", () => {
  it("returns the sole channel unchanged for mono", () => {
    expect(downmixChannels([[0.5, -0.5, 0.25]])).toEqual([0.5, -0.5, 0.25]);
  });

  it("averages the channels for stereo", () => {
    expect(downmixChannels([[1, 0, -1], [0, 0, 0]])).toEqual([0.5, 0, -0.5]);
  });

  it("returns an empty array when there is no signal", () => {
    expect(downmixChannels([])).toEqual([]);
    expect(downmixChannels([[], []])).toEqual([]);
  });

  it("uses the shortest channel length", () => {
    expect(downmixChannels([[1, 1, 1], [0, 0]])).toEqual([0.5, 0.5]);
  });
});

describe("resampleWaveform", () => {
  it("returns the requested number of points", () => {
    expect(resampleWaveform([0, 0.5, -0.5, 1], 8)).toHaveLength(8);
  });

  it("returns zeros when there is no signal", () => {
    expect(resampleWaveform([], 4)).toEqual([0, 0, 0, 0]);
  });

  it("preserves the signal shape by evenly sampling the window", () => {
    const frames = [0, 1, 0, -1];
    expect(resampleWaveform(frames, 4)).toEqual([0, 1, 0, -1]);
  });

  it("clamps samples outside the normalized range", () => {
    expect(resampleWaveform([5, -5], 2)).toEqual([1, -1]);
  });

  it("handles a zero-point request", () => {
    expect(resampleWaveform([0, 1], 0)).toEqual([]);
  });
});

describe("lerpWaveform", () => {
  it("returns the next frame without a previous frame", () => {
    expect(lerpWaveform(null, [1, 0], 0.5)).toEqual([1, 0]);
  });

  it("returns the next frame when lengths differ", () => {
    expect(lerpWaveform([0], [1, 1], 0.5)).toEqual([1, 1]);
  });

  it("returns the previous frame at t=0", () => {
    expect(lerpWaveform([0, 0], [1, 1], 0)).toEqual([0, 0]);
  });

  it("returns the next frame at t=1", () => {
    expect(lerpWaveform([0, 0], [1, 1], 1)).toEqual([1, 1]);
  });

  it("interpolates midway", () => {
    expect(lerpWaveform([0, 0], [1, 1], 0.5)).toEqual([0.5, 0.5]);
  });
});

describe("rms", () => {
  it("is zero for silence", () => {
    expect(rms([0, 0, 0, 0])).toBe(0);
  });

  it("is one for a full-scale square", () => {
    expect(rms([1, -1, 1, -1])).toBeCloseTo(1, 5);
  });

  it("is between zero and one for a partial signal", () => {
    const value = rms([0.5, -0.5]);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});
