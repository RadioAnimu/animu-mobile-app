import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backgroundService } from "../background.service";

beforeEach(() => {
  vi.useFakeTimers();
  backgroundService.stopAllTasks();
});

afterEach(() => {
  backgroundService.stopAllTasks();
  vi.useRealTimers();
});

describe("BackgroundService", () => {
  it("runs the callback repeatedly at the given interval", async () => {
    const callback = vi.fn(async () => {});
    backgroundService.startTask({ id: "t", callback, interval: 1_000 });

    await vi.advanceTimersByTimeAsync(2_500);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("never overlaps a slow run — next run waits for it to settle", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const callback = vi.fn(() => gate);
    backgroundService.startTask({ id: "t", callback, interval: 1_000 });

    await vi.advanceTimersByTimeAsync(5_000); // 5 interval fires while stuck
    expect(callback).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(1_000); // re-armed after settling
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("restarts cleanly when started again with the same id", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});

    backgroundService.startTask({ id: "t", callback: first, interval: 1_000 });
    backgroundService.startTask({ id: "t", callback: second, interval: 500 });

    await vi.advanceTimersByTimeAsync(600);
    expect(first).not.toHaveBeenCalled(); // old schedule cancelled
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("a restart while a run is in-flight continues with the new task", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = vi.fn(() => gate);
    const fast = vi.fn(async () => {});

    backgroundService.startTask({ id: "t", callback: slow, interval: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(slow).toHaveBeenCalledTimes(1);

    // Restart mid-run: no double-scheduling afterwards
    backgroundService.startTask({ id: "t", callback: fast, interval: 500 });
    release();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(fast).toHaveBeenCalledTimes(3); // 500ms chain, single schedule
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("stops cleanly, including a run in-flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const callback = vi.fn(() => gate);

    backgroundService.startTask({ id: "t", callback, interval: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    backgroundService.stopTask("t");
    release();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(callback).toHaveBeenCalledTimes(1); // never re-armed
  });
});
