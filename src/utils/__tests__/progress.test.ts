import { describe, expect, it } from "vitest";

import { elapsedAt, msUntilNextSecond, progressRatio } from "@/utils/progress";

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

describe("elapsedAt", () => {
  const anchor = { progressMs: 10_000, progressAt: 1_000, progressRunning: true };

  it("advances a running anchor in real time", () => {
    expect(elapsedAt(anchor, 60_000, 1_000)).toBe(10_000);
    expect(elapsedAt(anchor, 60_000, 4_500)).toBe(13_500);
  });

  it("holds a stopped anchor", () => {
    expect(elapsedAt({ ...anchor, progressRunning: false }, 60_000, 9_000)).toBe(10_000);
  });

  it("holds at the song's end and never goes below its start", () => {
    expect(elapsedAt(anchor, 12_000, 99_000)).toBe(12_000);
    expect(elapsedAt({ ...anchor, progressMs: -3_000 }, 60_000, 1_000)).toBe(0);
  });

  it("is unknown without an anchor, and unbounded without a duration", () => {
    expect(elapsedAt({ ...anchor, progressMs: null }, 60_000, 2_000)).toBeNull();
    expect(elapsedAt(anchor, 0, 101_000)).toBe(110_000);
  });
});

describe("msUntilNextSecond", () => {
  it("waits for the remaining time to cross the next whole second", () => {
    expect(msUntilNextSecond(5_300)).toBe(301);
    expect(msUntilNextSecond(5_000)).toBe(1);
    expect(msUntilNextSecond(4_999)).toBe(1_000);
  });
});
