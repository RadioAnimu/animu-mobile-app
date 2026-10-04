// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PROJECT_MS } from "@/hooks/smoothed-elapsed";
import { useSmoothedElapsed } from "@/hooks/useSmoothedElapsed";

const app = vi.hoisted(() => ({ backgrounded: false }));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({
  useIsBackgrounded: () => app.backgrounded,
}));

type Props = { target: number | null; key: string | null };

const render = (initial: Props) =>
  renderHook(({ target, key }: Props) => useSmoothedElapsed(target, key), {
    initialProps: initial,
  });

describe("useSmoothedElapsed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    app.backgrounded = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances at real time between ~1 Hz updates", () => {
    const { result, rerender } = render({ target: 10_000, key: "a" });
    expect(result.current).toBe(10_000);
    rerender({ target: 10_000, key: "a" });
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBeGreaterThan(10_500);
    expect(result.current).toBeLessThanOrEqual(11_000);
  });

  it("re-anchors at once on a track change", () => {
    const { result, rerender } = render({ target: 90_000, key: "a" });
    act(() => vi.advanceTimersByTime(500));
    rerender({ target: 1_200, key: "b" });
    expect(result.current).toBe(1_200);
  });

  it("shows nothing while the position is unknown, and holds still", () => {
    const { result, rerender } = render({ target: 5_000, key: "a" });
    rerender({ target: null, key: "a" });
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current).toBeNull();
  });

  it("snaps to the truth after a long silent stretch instead of sweeping", () => {
    const { result, rerender } = render({ target: 10_000, key: "a" });
    rerender({ target: 10_000, key: "a" });
    app.backgrounded = true;
    rerender({ target: 10_000, key: "a" });
    // Hidden: no ticking, the value holds.
    act(() => vi.advanceTimersByTime(MAX_PROJECT_MS + 5_000));
    expect(result.current).toBe(10_000);
    app.backgrounded = false;
    rerender({ target: 60_000, key: "a" });
    expect(result.current).toBe(60_000);
  });

  it("starts unknown, then anchors on the first value", () => {
    const { result, rerender } = render({ target: null, key: null });
    expect(result.current).toBeNull();
    rerender({ target: 3_000, key: "a" });
    expect(result.current).toBe(3_000);
  });
});
