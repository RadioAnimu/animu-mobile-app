import { describe, expect, it } from "vitest";

import {
  defaultPartitions,
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

describe("MB-scale sanity", () => {
  it("keeps a 250 MB total coherent", () => {
    const caps = resolvePartitionCaps(250 * MB)!;
    const sum = Object.values(caps).reduce((a, b) => a + b, 0);
    expect(sum).toBe(250 * MB);
  });
});

describe("defaultPartitions", () => {
  it("seeds the weighted automatic split in whole MB steps", () => {
    const seeded = defaultPartitions(50 * MB);
    for (const bytes of Object.values(seeded)) {
      expect(bytes % MB).toBe(0);
      expect(bytes).toBeGreaterThanOrEqual(MB);
    }
    // The engine caps the same limit; every seed must match its cap's
    // MB-floored value so the editor starts where the trim engine lands.
    const caps = resolvePartitionCaps(50 * MB)!;
    expect(seeded).toEqual({
      live: Math.floor(caps.live / MB) * MB,
      requested: Math.floor(caps.requested / MB) * MB,
      played: Math.floor(caps.played / MB) * MB,
      search: Math.floor(caps.search / MB) * MB,
    });
  });

  it("never seeds more than the user's limit", () => {
    for (const limit of [50, 100, 250, 500, 1024]) {
      const seeded = defaultPartitions(limit * MB);
      const sum = Object.values(seeded).reduce((a, b) => a + b, 0);
      expect(sum).toBeLessThanOrEqual(limit * MB);
    }
  });

  it("returns an empty override set for an unlimited limit", () => {
    expect(defaultPartitions(0)).toEqual({});
  });
});
