import { useEffect, useRef } from "react";
import { vi } from "vitest";
import { createReactNativeMock } from "@/__tests__/react-native-mock";

/** Deterministic host-side reactions; device tests still validate native motion. */
export function createReanimatedMock() {
  const { View, Text } = createReactNativeMock();
  const reactions = new Set<() => void>();
  const shared = <T,>(initial: T) => ({ value: initial, get() { return this.value; }, set(value: T) { this.value = value; } });
  const animate = <T,>(value: T, _config?: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; };
  return {
    default: { View, Text },
    shared,
    tick: () => { for (const run of [...reactions]) run(); },
    useSharedValue: <T,>(initial: T) => useRef(shared(initial)).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    useAnimatedReaction: <T,>(prepare: () => T, react: (value: T, previous: T | null) => void) => {
      const previous = useRef<T | null>(null);
      useEffect(() => {
        const run = () => { const value = prepare(); react(value, previous.current); previous.current = value; };
        reactions.add(run);
        run();
        return () => { reactions.delete(run); };
      });
    },
    withSpring: vi.fn(animate),
    withTiming: vi.fn(animate),
    withDelay: vi.fn((_delay: number, value: unknown) => value),
    withDecay: vi.fn(() => 0),
    cancelAnimation: vi.fn(),
    interpolate: (value: number, input: number[], output: number[]) => {
      const ratio = Math.max(0, Math.min(1, (value - input[0]) / (input[1] - input[0])));
      return output[0] + ratio * (output[1] - output[0]);
    },
    Extrapolation: { CLAMP: "clamp" },
  };
}
