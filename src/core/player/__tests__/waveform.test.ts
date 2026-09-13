import { describe, expect, it } from "vitest";
import { resampleWaveform, rms, smoothWaveform } from "../waveform";

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

describe("smoothWaveform", () => {
  it("returns the next frame unchanged without a previous frame", () => {
    expect(smoothWaveform(null, [1, 0], 0.5)).toEqual([1, 0]);
  });

  it("returns the next frame unchanged when the amount is zero", () => {
    expect(smoothWaveform([0, 0], [1, 1], 0)).toEqual([1, 1]);
  });

  it("blends the previous frame into the next", () => {
    expect(smoothWaveform([0, 0], [1, 1], 0.5)).toEqual([0.5, 0.5]);
  });

  it("ignores a previous frame of a different length", () => {
    expect(smoothWaveform([0], [1, 1], 0.5)).toEqual([1, 1]);
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
