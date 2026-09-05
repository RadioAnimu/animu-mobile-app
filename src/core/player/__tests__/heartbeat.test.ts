import { afterEach, describe, expect, it, vi } from "vitest";
import { HeartbeatScheduler } from "../heartbeat";

const makeScheduler = (debug = false) => {
  const expireStuckRefresh = vi.fn((): void => {});
  const tick = vi.fn((): void => {});
  const onPoll = vi.fn((): void => {});
  let playing = true;

  const scheduler = new HeartbeatScheduler({
    repository: { expireStuckRefresh },
    ticker: { tick },
    isPlayingIntent: () => playing,
    stateLabel: () => "playing",
    debug,
  });
  scheduler.onPoll = onPoll;

  return {
    scheduler,
    expireStuckRefresh,
    tick,
    onPoll,
    setPlaying: (value: boolean) => {
      playing = value;
    },
  };
};

/** Advances the fake clock and beats once — one processed beat per call. */
const beat = (
  fixture: ReturnType<typeof makeScheduler>,
  afterMs = 1000,
): void => {
  vi.setSystemTime(Date.now() + afterMs);
  fixture.scheduler.beat();
};

describe("HeartbeatScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gates beats closer than the window to one processed beat", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = makeScheduler();

    beat(fixture, 0);
    beat(fixture, 300); // inside the window — dropped

    expect(fixture.tick).toHaveBeenCalledTimes(1);
    expect(fixture.expireStuckRefresh).toHaveBeenCalledTimes(1);

    beat(fixture, 500); // 800ms after the first — processed

    expect(fixture.tick).toHaveBeenCalledTimes(2);
    expect(fixture.expireStuckRefresh).toHaveBeenCalledTimes(2);
  });

  it("runs the watchdog before the progress tick", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = makeScheduler();

    beat(fixture);

    const watchdogOrder = fixture.expireStuckRefresh.mock.invocationCallOrder[0];
    const tickOrder = fixture.tick.mock.invocationCallOrder[0];
    expect(watchdogOrder).toBeLessThan(tickOrder);
  });

  it("polls every 5 beats while the user wants audio", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = makeScheduler();

    for (let i = 0; i < 4; i++) beat(fixture);
    expect(fixture.onPoll).not.toHaveBeenCalled();

    beat(fixture); // 5th beat → poll
    expect(fixture.onPoll).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) beat(fixture);
    expect(fixture.onPoll).toHaveBeenCalledTimes(2);
  });

  it("polls every 30 beats while paused", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = makeScheduler();
    fixture.setPlaying(false);

    for (let i = 0; i < 29; i++) beat(fixture);
    expect(fixture.onPoll).not.toHaveBeenCalled();

    beat(fixture); // 30th beat → poll
    expect(fixture.onPoll).toHaveBeenCalledTimes(1);
  });

  it("does not count gate-dropped beats toward the poll cadence", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = makeScheduler();

    beat(fixture);
    for (let i = 0; i < 4; i++) fixture.scheduler.beat(); // dropped, no time passes
    expect(fixture.onPoll).not.toHaveBeenCalled();

    beat(fixture); // 2nd PROCESSED beat — cadence still at 2/5
    expect(fixture.onPoll).not.toHaveBeenCalled();
  });

  it("reset() releases the gate and restarts the poll cycle", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = makeScheduler();

    for (let i = 0; i < 5; i++) beat(fixture);
    expect(fixture.onPoll).toHaveBeenCalledTimes(1);

    fixture.scheduler.reset();

    // Same instant — the gate must accept the next beat immediately
    fixture.scheduler.beat();
    expect(fixture.tick).toHaveBeenCalledTimes(6);

    // …and the poll cycle counts from zero: the 5th beat after the reset polls
    for (let i = 0; i < 3; i++) beat(fixture);
    expect(fixture.onPoll).toHaveBeenCalledTimes(1);
    beat(fixture);
    expect(fixture.onPoll).toHaveBeenCalledTimes(2);
  });

  it("samples a debug line every 30 beats only when debug is on", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const verbose = makeScheduler(true);
      for (let i = 0; i < 30; i++) beat(verbose);
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toContain("[Heartbeat] ok");
      expect(infoSpy.mock.calls[0][0]).toContain("state=playing");

      const quiet = makeScheduler(false);
      for (let i = 0; i < 60; i++) beat(quiet);
      expect(infoSpy).toHaveBeenCalledTimes(1); // no further lines
    } finally {
      infoSpy.mockRestore();
    }
  });
});
