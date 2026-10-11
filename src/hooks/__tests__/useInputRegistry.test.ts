// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { TextInput } from "react-native";

import { useInputRegistry } from "@/hooks/useInputRegistry";

vi.mock("react-native-keyboard-controller", () => ({
  KeyboardController: { setFocusTo: vi.fn(), dismiss: vi.fn() },
}));

afterEach(cleanup);

const fakeInput = () =>
  ({ focus: vi.fn(), isFocused: () => false }) as unknown as TextInput;

describe("useInputRegistry", () => {
  it("focuses the input registered under a key", () => {
    const { result } = renderHook(() => useInputRegistry<"a" | "b">());
    const a = fakeInput();
    const b = fakeInput();
    result.current.register("a", a);
    result.current.register("b", b);

    result.current.focus("b");

    expect(b.focus).toHaveBeenCalledTimes(1);
    expect(a.focus).not.toHaveBeenCalled();
  });

  it("ignores keys that were never registered or were unmounted", () => {
    const { result } = renderHook(() => useInputRegistry<"a" | "b">());
    const a = fakeInput();
    result.current.register("a", a);
    result.current.register("a", null);

    expect(() => result.current.focus("a")).not.toThrow();
    expect(() => result.current.focus("b")).not.toThrow();
    expect(a.focus).not.toHaveBeenCalled();
  });

  it("keeps stable callbacks across renders", () => {
    const { result, rerender } = renderHook(() => useInputRegistry<"a">());
    const { register, focus } = result.current;
    rerender();
    expect(result.current.register).toBe(register);
    expect(result.current.focus).toBe(focus);
  });
});
