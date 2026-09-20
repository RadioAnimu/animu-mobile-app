import { describe, expect, it } from "vitest";
import { serverSkewFromDate } from "@/api/server-skew";

describe("serverSkewFromDate", () => {
  it("returns the server-minus-device offset at the RTT midpoint", () => {
    const sent = Date.parse("2026-01-01T00:00:00.000Z");
    // Server clock exactly 5 minutes behind the device (whole second, so the
    // header's resolution loses nothing).
    const serverDate = new Date(sent - 300_000).toUTCString();

    expect(serverSkewFromDate(serverDate, sent, sent)).toBe(-300_000);
  });

  it("subtracts half the round-trip", () => {
    const sent = Date.parse("2026-01-01T00:00:00.000Z");
    const received = sent + 2_000; // 2s RTT → midpoint sent + 1000
    // Server agrees with the device at the midpoint → zero offset.
    const serverDate = new Date(sent + 1_000).toUTCString();

    expect(serverSkewFromDate(serverDate, sent, received)).toBe(0);
  });

  it("is null without a usable header", () => {
    expect(serverSkewFromDate(null, 0, 0)).toBeNull();
    expect(serverSkewFromDate("not-a-date", 0, 0)).toBeNull();
  });

  it("keeps sub-second readings within the header's resolution", () => {
    const sent = Date.parse("2026-01-01T00:00:00.000Z");
    const serverDate = new Date(sent).toUTCString();
    const skew = serverSkewFromDate(serverDate, sent, sent + 200);

    expect(skew).not.toBeNull();
    expect(Math.abs(skew!)).toBeLessThanOrEqual(1_000);
  });
});
