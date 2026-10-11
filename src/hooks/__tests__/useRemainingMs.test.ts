// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRemainingMs } from "@/hooks/useRemainingMs";
import type { ProgressAnchor } from "@/utils/progress";

const NOW = new Date("2026-10-05T05:00:00Z").getTime();
const DURATION = 200_000;

type Props = { anchor: ProgressAnchor; active: boolean };

const render = (initial: Props) =>
  renderHook(({ anchor, active }: Props) => useRemainingMs(anchor, DURATION, active), {
    initialProps: initial,
  });

/** The whole seconds a countdown shows. */
const shown = (remainingMs: number) => Math.floor(remainingMs / 1000);

describe("useRemainingMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spawns at the live value, not the anchor's", () => {
    const anchor = { progressMs: 50_000, progressAt: NOW - 30_000, progressRunning: true };
    const { result } = render({ anchor, active: true });
    expect(result.current).toBe(120_000);
  });

  it("flips each displayed second exactly one second apart", () => {
    // 10.3 s into the song: 189.7 s left, "3:09".
    const anchor = { progressMs: 10_300, progressAt: NOW, progressRunning: true };
    const { result } = render({ anchor, active: true });
    expect(shown(result.current)).toBe(189);
    // Flips to 188 at the boundary (700 ms), not on a polling tick.
    act(() => vi.advanceTimersByTime(699));
    expect(shown(result.current)).toBe(189);
    act(() => vi.advanceTimersByTime(2));
    expect(shown(result.current)).toBe(188);
    for (let second = 187; second > 180; second--) {
      act(() => vi.advanceTimersByTime(999));
      expect(shown(result.current)).toBe(second + 1);
      act(() => vi.advanceTimersByTime(1));
      expect(shown(result.current)).toBe(second);
    }
  });

  it("holds while the audio is stopped or the app is hidden", () => {
    const stopped = { progressMs: 10_000, progressAt: NOW, progressRunning: false };
    const { result, rerender } = render({ anchor: stopped, active: true });
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe(190_000);

    const running = { ...stopped, progressAt: Date.now(), progressRunning: true };
    rerender({ anchor: running, active: false });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ anchor: running, active: true });
    act(() => vi.advanceTimersByTime(3_000));
    expect(shown(result.current)).toBe(187);
  });

  it("stops at zero past the song's end", () => {
    const anchor = { progressMs: 199_500, progressAt: NOW, progressRunning: true };
    const { result } = render({ anchor, active: true });
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows the whole song while the position is unknown", () => {
    const anchor = { progressMs: null, progressAt: 0, progressRunning: false };
    const { result } = render({ anchor, active: true });
    expect(result.current).toBe(DURATION);
    expect(vi.getTimerCount()).toBe(0);
  });
});
