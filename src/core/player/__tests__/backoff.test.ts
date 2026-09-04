import { describe, expect, it } from "vitest";
import { BackoffScheduler } from "../backoff";
import { createFakeTimer } from "./fake-timer";

const BASE_MS = 2000;
const MAX_MS = 30_000;

const makeScheduler = () => {
  const timer = createFakeTimer();
  const scheduler = new BackoffScheduler({
    baseMs: BASE_MS,
    maxMs: MAX_MS,
    timer,
    label: "test",
  });
  return { timer, scheduler };
};

describe("BackoffScheduler", () => {
  it("doubles the delay per consecutive attempt and caps at max", () => {
    const { scheduler } = makeScheduler();
    const delays: number[] = [];

    for (let i = 0; i < 6; i++) {
      delays.push(scheduler.schedule(() => {}));
    }

    expect(delays).toEqual([2000, 4000, 8000, 16_000, 30_000, 30_000]);
  });

  it("runs exactly one action per scheduled timer", () => {
    const { timer, scheduler } = makeScheduler();
    let runs = 0;

    scheduler.schedule(() => runs++);
    timer.advance(BASE_MS - 1);
    expect(runs).toBe(0);
    timer.advance(1);
    expect(runs).toBe(1);
    expect(scheduler.isPending).toBe(false);
  });

  it("replaces a pending timer when scheduled again", () => {
    const { timer, scheduler } = makeScheduler();
    let runs = 0;

    scheduler.schedule(() => runs++); // attempt 0 → 2000ms
    scheduler.schedule(() => runs++); // attempt 1 → 4000ms, replaces the first
    expect(timer.scheduled).toHaveLength(1);
    expect(scheduler.isPending).toBe(true);

    timer.advance(BASE_MS * 2);
    expect(runs).toBe(1);
  });

  it("cancel keeps the attempt counter, reset zeroes it", () => {
    const { scheduler } = makeScheduler();

    scheduler.schedule(() => {});
    scheduler.schedule(() => {});
    scheduler.cancel();
    expect(scheduler.attemptCount).toBe(2);
    expect(scheduler.isPending).toBe(false);

    scheduler.reset();
    expect(scheduler.attemptCount).toBe(0);
    expect(scheduler.schedule(() => {})).toBe(BASE_MS);
  });
});
