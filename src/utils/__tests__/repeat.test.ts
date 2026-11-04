import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repeatEvery } from "@/utils/repeat";

const gated = () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  return { task: vi.fn(() => gate), release };
};

describe("repeatEvery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the task at the given interval", async () => {
    const task = vi.fn(async () => {});
    const stop = repeatEvery(1_000, task);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("never overlaps a slow run: the next waits for it to settle", async () => {
    const { task, release } = gated();
    const stop = repeatEvery(1_000, task);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(task).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops for good, including after a run in flight", async () => {
    const { task, release } = gated();
    const stop = repeatEvery(1_000, task);
    await vi.advanceTimersByTimeAsync(1_000);
    stop();
    release();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("keeps going after a task that throws synchronously", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const task = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => {
        throw new Error("sync");
      })
      .mockResolvedValue(undefined);
    const stop = repeatEvery(1_000, task);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
    error.mockRestore();
  });

  it("keeps going after a failed run", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const stop = repeatEvery(1_000, task);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
    error.mockRestore();
  });
});
