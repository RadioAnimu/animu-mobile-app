// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LYRICS_LEAD_MS, useHeardPosition } from "@/hooks/useHeardPosition";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  frame: null as null | (() => void),
  frames: { setActive: vi.fn() },
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => ({ readHeardPosition: mocks.read }),
}));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  return {
    useSharedValue: <T,>(initial: T) => {
      const ref = useRef({
        value: initial,
        get() {
          return this.value;
        },
        set(value: T) {
          this.value = value;
        },
      });
      return ref.current;
    },
    useFrameCallback: (callback: () => void) => {
      mocks.frame = callback;
      return mocks.frames;
    },
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  mocks.read.mockReturnValue(null);
});
afterEach(() => vi.useRealTimers());

describe("heard lyrics clock", () => {
  it("stays unknown until the audible title matches, then follows frames and pause", () => {
    mocks.read.mockReturnValue({
      raw: "other song",
      elapsedMs: 900,
      advancing: true,
    });
    const { result, unmount } = renderHook(() =>
      useHeardPosition("song", true),
    );
    expect(result.current.known).toBe(false);
    expect(mocks.frames.setActive).toHaveBeenLastCalledWith(false);
    mocks.read.mockReturnValue({
      raw: "song",
      elapsedMs: 2_000,
      advancing: true,
    });
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.known).toBe(true);
    expect(mocks.frames.setActive).toHaveBeenLastCalledWith(true);
    act(() => {
      vi.advanceTimersByTime(100);
      mocks.frame!();
    });
    expect(result.current.position.get()).toBe(2_100 + LYRICS_LEAD_MS);
    mocks.read.mockReturnValue({
      raw: "song",
      elapsedMs: 2_200,
      advancing: false,
    });
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.position.get()).toBe(2_200 + LYRICS_LEAD_MS);
    expect(mocks.frames.setActive).toHaveBeenLastCalledWith(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does no sampling while inactive and releases the frame loop on blur", () => {
    mocks.read.mockReturnValue({ raw: "song", elapsedMs: 10, advancing: true });
    const { result, rerender, unmount } = renderHook(
      ({ active }) => useHeardPosition("song", active),
      { initialProps: { active: false } },
    );
    expect(mocks.read).not.toHaveBeenCalled();
    expect(result.current.known).toBe(false);
    rerender({ active: true });
    expect(result.current.known).toBe(true);
    rerender({ active: false });
    expect(result.current.known).toBe(false);
    expect(mocks.frames.setActive).toHaveBeenLastCalledWith(false);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it("absorbs sampling jitter but reanchors after real drift or loss of metadata", () => {
    mocks.read.mockReturnValue({
      raw: "song",
      elapsedMs: 1_000,
      advancing: true,
    });
    const { result, unmount } = renderHook(() =>
      useHeardPosition("song", true),
    );
    mocks.read.mockReturnValue({
      raw: "song",
      elapsedMs: 1_270,
      advancing: true,
    });
    act(() => {
      vi.advanceTimersByTime(250);
      mocks.frame!();
    });
    expect(result.current.position.get()).toBe(1_250 + LYRICS_LEAD_MS);
    mocks.read.mockReturnValue({
      raw: "song",
      elapsedMs: 5_000,
      advancing: true,
    });
    act(() => {
      vi.advanceTimersByTime(250);
      mocks.frame!();
    });
    expect(result.current.position.get()).toBe(5_000 + LYRICS_LEAD_MS);
    mocks.read.mockReturnValue(null);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.known).toBe(false);
    expect(result.current.position.get()).toBeNaN();
    unmount();
  });
});
