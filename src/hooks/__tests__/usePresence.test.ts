// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { Animated } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePresence } from "@/hooks/usePresence";
import { MOTION } from "@/theme/motion";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

type Finish = (result: { finished: boolean }) => void;

/** The last timing animation: its config and a way to complete it. */
const lastTiming = () => {
  const calls = vi.mocked(Animated.timing).mock;
  const config = calls.calls.at(-1)![1] as { toValue: number; duration: number };
  const handle = calls.results.at(-1)!.value as { start: ReturnType<typeof vi.fn> };
  const finish = (finished: boolean) =>
    act(() => (handle.start.mock.calls.at(-1)![0] as Finish)({ finished }));
  return { config, finish };
};

describe("usePresence", () => {
  afterEach(cleanup);

  it("stays unmounted and idle while hidden", () => {
    const { result } = renderHook(() => usePresence(false));
    expect(result.current.mounted).toBe(false);
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  it("mounts at once and enters at the NORMAL tempo", () => {
    const { result } = renderHook(() => usePresence(true));
    expect(result.current.mounted).toBe(true);
    const { config } = lastTiming();
    expect(config).toMatchObject({ toValue: 1, duration: MOTION.DURATION.NORMAL });
  });

  it("leaves faster than it arrives and unmounts only once the exit finished", () => {
    const { result, rerender } = renderHook(({ visible }) => usePresence(visible), {
      initialProps: { visible: true },
    });
    rerender({ visible: false });

    const exit = lastTiming();
    expect(exit.config).toMatchObject({ toValue: 0, duration: MOTION.DURATION.FAST });
    expect(result.current.mounted).toBe(true);

    // An interrupted exit (re-shown mid-way) must not unmount the surface.
    exit.finish(false);
    expect(result.current.mounted).toBe(true);

    exit.finish(true);
    expect(result.current.mounted).toBe(false);
  });
});
