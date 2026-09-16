import { describe, expect, it } from "vitest";

import { CoverFileHashMap } from "../cover-file-cache";

const A = "https://cdn/trackImage1_large.jpg";
const B = "https://cdn/trackImage2_large.jpg";
const C = "https://cdn/trackImage3_large.jpg";
const D = "https://cdn/trackImage4_large.jpg";

describe("CoverFileHashMap (LRU hashmap impl)", () => {
  it("tracks and peeks entries", () => {
    const map = new CoverFileHashMap();
    map.track(A, "file://a");
    expect(map.peek(A)).toBe("file://a");
    expect(map.size).toBe(1);
  });

  it("track() is an upsert — same URL keeps one entry", () => {
    const map = new CoverFileHashMap();
    map.track(A, "file://a");
    map.track(A, "file://a2");
    expect(map.peek(A)).toBe("file://a2");
    expect(map.size).toBe(1);
  });

  it("evicts the least-recently-used entry past capacity", () => {
    const map = new CoverFileHashMap(3);
    map.track(A, "file://a");
    map.track(B, "file://b");
    map.track(C, "file://c");
    // Recency bump on A — B becomes the oldest
    map.track(A, "file://a");
    map.track(D, "file://d");

    expect(map.peek(B)).toBeUndefined();
    expect(map.peek(A)).toBe("file://a");
    expect(map.peek(C)).toBe("file://c");
    expect(map.peek(D)).toBe("file://d");
    expect(map.size).toBe(3);
  });

  it("seeded-file responses evicted from the map are re-probed next resolve (no memory leak)", () => {
    const map = new CoverFileHashMap(1);
    map.track(A, "file://a");
    map.track(B, "file://b");
    expect(map.size).toBe(1);
  });

  it("clear() empties the map", () => {
    const map = new CoverFileHashMap();
    map.track(A, "file://a");
    map.track(B, "file://b");
    map.clear();
    expect(map.size).toBe(0);
    expect(map.peek(A)).toBeUndefined();
  });

  it("capacity below 1 is rejected", () => {
    expect(() => new CoverFileHashMap(0)).toThrow(RangeError);
  });

  it("capacity 1 keeps exactly the most recent entry", () => {
    const map = new CoverFileHashMap(1);
    map.track(A, "file://a");
    map.track(B, "file://b");
    expect(map.size).toBe(1);
    expect(map.peek(B)).toBe("file://b");
  });
});
