// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { AccessibilityInfo, Animated } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStepFade } from "@/hooks/useStepFade";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

describe("useStepFade", () => {
  beforeEach(() => {
    vi.mocked(Animated.timing).mockClear();
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it("stays opaque and silent on the first render", () => {
    const { result } = renderHook(() => useStepFade("email"));
    expect((result.current as unknown as { value: number }).value).toBe(1);
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  it("restarts from transparent and fades in on a step change", () => {
    const { result, rerender } = renderHook(({ step }) => useStepFade(step), {
      initialProps: { step: "email" },
    });
    rerender({ step: "code" });
    expect((result.current as unknown as { value: number }).value).toBe(0);
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Animated.timing).mock.calls[0][1]).toMatchObject({
      toValue: 1,
      duration: 110,
      useNativeDriver: true,
    });
    // Re-rendering on the same step (a resend tick) does not replay it.
    rerender({ step: "code" });
    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });

  it("switches immediately with Reduce Motion on", async () => {
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    const { result, rerender } = renderHook(({ step }) => useStepFade(step), {
      initialProps: { step: "email" },
    });
    // Let the preference resolve.
    await waitFor(() => rerender({ step: "email" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    rerender({ step: "code" });
    expect((result.current as unknown as { value: number }).value).toBe(1);
    expect(Animated.timing).not.toHaveBeenCalled();
  });
});
