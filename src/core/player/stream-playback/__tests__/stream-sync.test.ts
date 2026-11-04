import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamSyncEngine, type LiveOffsetReading } from "@/core/player/stream-playback/stream-sync";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/** RNAP's reading now: `liveOffset` s behind live, settled unless told. */
const live = (liveOffset: number, liveOffsetSettled = true): LiveOffsetReading => ({
  liveOffset,
  liveOffsetSettled,
  bufferedAhead: 4,
  timestamp: Date.now(),
});

describe("StreamSyncEngine", () => {
  it("is the device clock before any reading", () => {
    const engine = new StreamSyncEngine();

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.settled).toBe(false);
    expect(engine.now()).toBe(Date.now());
  });

  it("estimates from an unsettled reading, and settles on RNAP's word", () => {
    const engine = new StreamSyncEngine();
    expect(engine.reading(live(5, false))).toBe(false);
    expect(engine.hasMeasurement).toBe(true);
    expect(engine.anchor).toBeNull();
    expect(engine.now()).toBe(Date.now() - 5_000);

    expect(engine.reading(live(7.5))).toBe(true);
    expect(engine.settled).toBe(true);
    expect(engine.anchor).toEqual({ stationMs: Date.now() - 7_500, at: Date.now(), running: true });
    expect(engine.lockedLag).toBe(7_500);
  });

  it("holds still through readings that agree, and moves for one that does not", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(7.5));
    const anchor = engine.anchor;
    vi.advanceTimersByTime(1_000);
    expect(engine.reading(live(7.54))).toBe(false);
    expect(engine.anchor).toBe(anchor);
    expect(engine.now()).toBe(Date.now() - 7_500);

    vi.advanceTimersByTime(1_000);
    expect(engine.reading(live(9))).toBe(true);
    expect(engine.now()).toBe(Date.now() - 9_000);
  });

  it("keeps the settled clock while a new reading settles", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(7.5));
    expect(engine.reading(live(15, false))).toBe(false);
    expect(engine.now()).toBe(Date.now() - 7_500);
  });

  it("reads the buffer on a browser's plain <audio> (no live offset), moved only when lastingly behind", () => {
    const engine = new StreamSyncEngine();
    const buffer = (bufferedAhead: number) =>
      engine.reading({ liveOffset: null, liveOffsetSettled: false, bufferedAhead, timestamp: Date.now() });
    buffer(3);
    expect(engine.settled).toBe(true);
    expect(engine.now()).toBe(Date.now() - 3_000);

    // It drains between loads: a lower reading never moves the clock.
    vi.advanceTimersByTime(1_000);
    expect(buffer(2)).toBe(false);
    expect(engine.now()).toBe(Date.now() - 3_000);
    // Well above the clock's lag it does.
    expect(buffer(5.5)).toBe(true);
    expect(engine.now()).toBe(Date.now() - 5_500);
  });

  it("places the clock at the reading's own time", () => {
    const engine = new StreamSyncEngine();
    engine.reading({ ...live(7.5), timestamp: Date.now() - 200 });

    expect(engine.now()).toBe(Date.now() - 7_500);
  });

  it("ignores negative or non-finite readings", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(-1));
    engine.reading(live(Number.NaN));

    expect(engine.hasMeasurement).toBe(false);
  });

  it("holds while audio is stopped, the stopped time added to the lag", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(5));
    engine.setRunning(false);
    const held = engine.now();
    vi.advanceTimersByTime(4_000);

    expect(engine.now()).toBe(held);
    expect(engine.lockedLag).toBe(9_000);
    engine.setRunning(true);
    vi.advanceTimersByTime(1_000);
    expect(engine.now()).toBe(held + 1_000);
  });

  it("reset() drops the reading and the clock", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(5));
    engine.reset();

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.anchor).toBeNull();
    expect(engine.lockedLag).toBeNull();
    expect(engine.now()).toBe(Date.now());
  });

  it("reports audibility of a track start", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(3));

    expect(engine.isAudible(Date.now())).toBe(false);
    expect(engine.isAudible(Date.now() - 4_000)).toBe(true);
  });

  it("a skew applied after the clock is placed moves it at the next settled reading", () => {
    const engine = new StreamSyncEngine();
    engine.reading(live(5));
    for (let i = 0; i < 3; i++) engine.setClockSkew(-60_000);
    expect(engine.now()).toBe(Date.now() - 5_000);

    expect(engine.reading(live(5))).toBe(true);
    expect(engine.now()).toBe(Date.now() - 65_000);
  });

  it("applies a gross server-clock correction to now()", () => {
    const engine = new StreamSyncEngine();
    // Device is 60s ahead of the server → station time is 60s behind it.
    engine.setClockSkew(-60_000);
    engine.reading(live(0));

    expect(engine.clockSkew).toBe(-60_000);
    expect(engine.now()).toBe(Date.now() - 60_000);
  });

  it("ignores sub-threshold clock skew (date header resolution)", () => {
    const engine = new StreamSyncEngine();
    engine.setClockSkew(800);

    expect(engine.clockSkew).toBe(0);
    expect(engine.now()).toBe(Date.now());
  });

  it("corrects a moderate device-clock error once a median agrees", () => {
    const engine = new StreamSyncEngine();
    for (const skew of [2_100, 1_900, 2_000]) engine.setClockSkew(skew, 80);

    expect(engine.clockSkew).toBe(2_000);
  });

  it("does not let one outlier or slow round-trip move the clock", () => {
    const engine = new StreamSyncEngine();
    for (const skew of [100, -200, 50, 120]) engine.setClockSkew(skew, 60);
    engine.setClockSkew(45_000, 60); // cached/odd response
    engine.setClockSkew(9_000, 4_000); // slow round-trip: dropped

    expect(engine.clockSkew).toBe(0);
  });

  it("holds an applied skew until it drops well below the apply threshold", () => {
    const engine = new StreamSyncEngine();
    for (let i = 0; i < 9; i++) engine.setClockSkew(1_600, 50);
    expect(engine.clockSkew).toBe(1_600);

    // Hovering just under the apply threshold must not flap the clock…
    for (let i = 0; i < 9; i++) engine.setClockSkew(1_200, 50);
    expect(engine.clockSkew).toBe(1_200);

    // …only a genuinely corrected device clock releases it.
    for (let i = 0; i < 9; i++) engine.setClockSkew(300, 50);
    expect(engine.clockSkew).toBe(0);
  });

  it("corrects the fallback clock before any lag measurement", () => {
    const engine = new StreamSyncEngine();
    engine.setClockSkew(-60_000);

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.now()).toBe(Date.now() - 60_000);
  });

  it("keeps the clock correction across reset()", () => {
    const engine = new StreamSyncEngine();
    engine.setClockSkew(-60_000);
    engine.reset();

    expect(engine.clockSkew).toBe(-60_000);
  });
});
