import { afterEach, describe, expect, it, vi } from "vitest";

import {
  maxSelectableLimitBytes,
  readDiskCapacity,
} from "../device-storage.service";

const state = vi.hoisted(() => ({
  total: 64 * 1024 * 1024 * 1024,
  available: 4 * 1024 * 1024 * 1024,
  throwOnCapacity: false,
}));

vi.mock("expo-file-system", () => ({
  Paths: {
    get totalDiskSpace() {
      if (state.throwOnCapacity) throw new Error("boom");
      return state.total;
    },
    get availableDiskSpace() {
      if (state.throwOnCapacity) throw new Error("boom");
      return state.available;
    },
  },
}));

const MB = 1024 * 1024;
const GB = 1024 * MB;

afterEach(() => {
  state.total = 64 * GB;
  state.available = 4 * GB;
  state.throwOnCapacity = false;
});

describe("readDiskCapacity", () => {
  it("derives used bytes from total minus available", () => {
    expect(readDiskCapacity()).toEqual({
      totalBytes: 64 * GB,
      availableBytes: 4 * GB,
      usedBytes: 60 * GB,
    });
  });

  it("never reports used below zero", () => {
    state.available = state.total + 1;
    expect(readDiskCapacity().usedBytes).toBe(0);
  });

  it("degrades to zeros when the native getters throw", () => {
    state.throwOnCapacity = true;
    expect(readDiskCapacity()).toEqual({
      totalBytes: 0,
      availableBytes: 0,
      usedBytes: 0,
    });
  });
});

describe("maxSelectableLimitBytes", () => {
  it("floors to the whole MB the device can currently hold", () => {
    expect(maxSelectableLimitBytes(500.9 * MB)).toBe(500 * MB);
  });

  it("never drops below a positive minimum", () => {
    expect(maxSelectableLimitBytes(0)).toBe(MB);
    expect(maxSelectableLimitBytes(100)).toBe(MB);
  });
});
