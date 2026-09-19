// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useBoundedRetry } from "@/hooks/useBoundedRetry";

const DELAY = 3000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("useBoundedRetry", () => {
  it("retries a failure after the delay, then gives up at maxRetries", () => {
    const { result } = renderHook(() => useBoundedRetry("key"));

    act(() => result.current.fail());
    expect(result.current.failed).toBe(true);

    act(() => void vi.advanceTimersByTime(DELAY));
    expect(result.current.failed).toBe(false);
    expect(result.current.retry).toBe(1);

    act(() => result.current.fail());
    act(() => void vi.advanceTimersByTime(DELAY));
    expect(result.current.retry).toBe(2);

    // Third failure is past maxRetries (2) — it sticks.
    act(() => result.current.fail());
    act(() => void vi.advanceTimersByTime(DELAY));
    expect(result.current.failed).toBe(true);
    expect(result.current.retry).toBe(2);
  });

  it("resets the failure and retry count when the key changes", () => {
    const { result, rerender } = renderHook(({ key }) => useBoundedRetry(key), {
      initialProps: { key: "a" },
    });

    act(() => result.current.fail());
    expect(result.current.failed).toBe(true);

    rerender({ key: "b" });
    expect(result.current.failed).toBe(false);
    expect(result.current.retry).toBe(0);
  });

  it("ignores a late failure from a superseded key", () => {
    const { result, rerender } = renderHook(({ key }) => useBoundedRetry(key), {
      initialProps: { key: "a" },
    });
    const staleFail = result.current.fail;

    rerender({ key: "b" });
    act(() => staleFail());

    expect(result.current.failed).toBe(false);
  });
});
