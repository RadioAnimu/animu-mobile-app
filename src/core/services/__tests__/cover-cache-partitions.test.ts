import { describe, expect, it } from "vitest";

import {
  automaticSharePercent,
  resolvePartitionCaps,
} from "@/core/services/cover-cache-partitions";

const MB = 1024 * 1024;

describe("resolvePartitionCaps", () => {
  it("returns null when there is no limit (unlimited)", () => {
    expect(resolvePartitionCaps(0)).toBeNull();
    expect(resolvePartitionCaps(-5, { live: 10 })).toBeNull();
  });

  it("splits the total by the documented weights", () => {
    const caps = resolvePartitionCaps(1000)!;
    expect(caps).toEqual({
      live: 300, // 30%
      requested: 150, // 15%
      played: 250, // 25%
      search: 300, // 30%
    });
  });

  it("takes custom values off the top and shares the rest proportionally", () => {
    // search pinned to 600 → leftover 400 shared by live .3 / requested .15 /
    // played .25 (total weight .7)
    const caps = resolvePartitionCaps(1000, { search: 600 })!;
    expect(caps.search).toBe(600);
    expect(caps.live).toBe(Math.round((400 * 0.3) / 0.7));
    expect(caps.requested).toBe(Math.round((400 * 0.15) / 0.7));
    expect(caps.played).toBe(Math.round((400 * 0.25) / 0.7));
  });

  it("degrades gracefully when overrides exceed the total", () => {
    const caps = resolvePartitionCaps(1000, { search: 999 })!;
    expect(caps.search).toBe(999);
    expect(caps.live).toBe(0);
    expect(caps.requested).toBe(0);
    expect(caps.played).toBe(0);
  });

  it("clamps negative overrides to zero", () => {
    const caps = resolvePartitionCaps(1000, { live: -50 })!;
    expect(caps.live).toBe(0);
  });
});

describe("automaticSharePercent", () => {
  it("reports the default weights as whole percents", () => {
    expect(automaticSharePercent("live")).toBe(30);
    expect(automaticSharePercent("requested")).toBe(15);
    expect(automaticSharePercent("played")).toBe(25);
    expect(automaticSharePercent("search")).toBe(30);
  });
});

describe("MB-scale sanity", () => {
  it("keeps a 250 MB total coherent", () => {
    const caps = resolvePartitionCaps(250 * MB)!;
    const sum = Object.values(caps).reduce((a, b) => a + b, 0);
    expect(sum).toBe(250 * MB);
  });
});
