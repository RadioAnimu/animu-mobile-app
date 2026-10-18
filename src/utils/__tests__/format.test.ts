import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatResultCount,
  interpolate,
  percentOf,
} from "@/utils/format";

describe("formatBytes", () => {
  it("returns 0 MB for zero and non-finite input", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(-10)).toBe("0 MB");
    expect(formatBytes(Number.NaN)).toBe("0 MB");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 MB");
  });

  it("scales through B / KB / MB / GB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(254 * 1024)).toBe("254 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
    expect(formatBytes(20 * 1024 * 1024 * 1024)).toBe("20 GB");
  });

  it("uses the given decimal separator for fractional sizes only", () => {
    expect(formatBytes(5 * 1024 * 1024, ",")).toBe("5,0 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024, ",")).toBe("1,5 GB");
    expect(formatBytes(12 * 1024 * 1024, ",")).toBe("12 MB");
    expect(formatBytes(2048, ",")).toBe("2 KB");
  });
});

describe("percentOf", () => {
  it("returns a clamped whole percent", () => {
    expect(percentOf(0, 100)).toBe(0);
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(200, 100)).toBe(100);
  });

  it("is safe when the whole is zero or invalid", () => {
    expect(percentOf(50, 0)).toBe(0);
    expect(percentOf(50, -1)).toBe(0);
    expect(percentOf(Number.NaN, 100)).toBe(0);
  });
});

describe("interpolate", () => {
  it("replaces named tokens", () => {
    expect(interpolate("{a} of {b}", { a: "1 MB", b: "2 MB" })).toBe(
      "1 MB of 2 MB",
    );
  });

  it("leaves unknown tokens untouched", () => {
    expect(interpolate("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});

describe("formatResultCount", () => {
  const en = {
    REQUEST_SEARCH_COUNT_ONE: "1 result",
    REQUEST_SEARCH_COUNT_N: "{n} results",
    NUMBER_DECIMAL_SEPARATOR: ".",
  };
  const pt = {
    REQUEST_SEARCH_COUNT_ONE: "1 resultado",
    REQUEST_SEARCH_COUNT_N: "{n} resultados",
    NUMBER_DECIMAL_SEPARATOR: ",",
  };

  it("uses the singular for exactly one", () => {
    expect(formatResultCount(1, en)).toBe("1 result");
  });

  it("groups thousands with the language's mark", () => {
    expect(formatResultCount(169, en)).toBe("169 results");
    expect(formatResultCount(3177, en)).toBe("3,177 results");
    expect(formatResultCount(1234567, pt)).toBe("1.234.567 resultados");
  });
});
