import { describe, expect, it } from "vitest";

import { isBarCorrection, progressRatio } from "@/utils/progress";

describe("progressRatio", () => {
  it("clamps elapsed into the 0..1 bar range", () => {
    expect(progressRatio(2500, 10_000)).toBe(0.25);
    expect(progressRatio(12_000, 10_000)).toBe(1);
    expect(progressRatio(-100, 10_000)).toBe(0);
  });

  it("absent or invalid progress reads as the start", () => {
    expect(progressRatio(null, 10_000)).toBe(0);
    expect(progressRatio(Number.NaN, 10_000)).toBe(0);
    expect(progressRatio(1000, 0)).toBe(0);
    expect(progressRatio(1000, Number.NaN)).toBe(0);
  });
});

describe("isBarCorrection", () => {
  const SHORT = 8_000; // 8s track
  const LONG = 3_000_000; // 50m track

  it("a fresh per-tick advance on a short track animates, not snaps", () => {
    // 250ms of audio ≈ 3.1% of an 8s track — a normal smooth advance.
    expect(isBarCorrection(0.031_25, 250, SHORT)).toBe(false);
  });

  it("a normal per-tick advance on a long track animates too", () => {
    // 250ms of audio on a 50m track is a minuscule ratio movement.
    expect(isBarCorrection(0.000_008, 250, LONG)).toBe(false);
  });

  it("a move beyond real-playback speed is a correction and snaps", () => {
    // Sync fix on a long track: 10% jump out of nowhere (250ms since render).
    expect(isBarCorrection(0.1, 250, LONG)).toBe(true);
  });

  it("a track change resetting to 0 is a correction", () => {
    expect(isBarCorrection(-0.9, 250, LONG)).toBe(true);
    expect(isBarCorrection(-0.1, 250, SHORT)).toBe(true);
  });

  it("the per-bar floor still snaps sub-real-time jitter on long tracks", () => {
    // Tiny wall-time window but a jump above the floor.
    expect(isBarCorrection(0.05, 10, LONG)).toBe(true);
  });

  it("without a duration the flat floor applies in both directions", () => {
    expect(isBarCorrection(0.05, 250, undefined)).toBe(true);
    // Track change resetting to 0 with no known duration must snap, not sweep.
    expect(isBarCorrection(-0.4, 250, 0)).toBe(true);
    expect(isBarCorrection(-0.01, 250, undefined)).toBe(false);
  });

  it("any backward move above the floor is a correction, even within the real-time window", () => {
    // A sync re-lock after a thaw can pull the bar back; real playback never
    // travels backwards, so this must snap on short tracks too.
    expect(isBarCorrection(-0.05, 250, SHORT)).toBe(true);
    expect(isBarCorrection(-0.01, 250, SHORT)).toBe(false);
  });

  it("a late update crossing the max real-time window still animates", () => {
    // 2s of silent wall time on a 8s track: expected ≈ 37.5%… beyond that
    // the correction is a real re-anchor.
    expect(isBarCorrection(0.5, 2000, SHORT)).toBe(true);
    // But a gap explainable by real playback stays smooth.
    expect(isBarCorrection(0.3, 2000, SHORT)).toBe(false);
  });
});
