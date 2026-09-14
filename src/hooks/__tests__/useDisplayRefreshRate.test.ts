import { describe, expect, it } from "vitest";
import { buildHzStops, nearestHzStop } from "../useDisplayRefreshRate";

describe("buildHzStops", () => {
  it("derives off / half / 80% / max for 60 Hz", () => {
    expect(buildHzStops(60)).toEqual([0, 30, 48, 60]);
  });

  it("derives off / half / 80% / max for 120 Hz", () => {
    expect(buildHzStops(120)).toEqual([0, 60, 96, 120]);
  });

  it("derives stops for 90 Hz", () => {
    expect(buildHzStops(90)).toEqual([0, 45, 72, 90]);
  });

  it("dedupes collisions", () => {
    expect(buildHzStops(30)).toEqual([0, 15, 24, 30]);
  });
});

describe("nearestHzStop", () => {
  const stops = [0, 30, 48, 60];

  it("snaps up to the closest stop", () => {
    expect(nearestHzStop(59, stops)).toBe(60);
    expect(nearestHzStop(50, stops)).toBe(48);
  });

  it("snaps down to the closest stop", () => {
    expect(nearestHzStop(10, stops)).toBe(0);
    expect(nearestHzStop(20, stops)).toBe(30);
  });
});
