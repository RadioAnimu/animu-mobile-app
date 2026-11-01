import { afterEach, describe, expect, it, vi } from "vitest";
import { whenIdle } from "@/utils/idle";

describe("whenIdle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("falls back to a macrotask where there is no requestIdleCallback (Safari)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();
    whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending fallback task", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();
    whenIdle(task)();
    vi.runAllTimers();
    expect(task).not.toHaveBeenCalled();
  });
});
