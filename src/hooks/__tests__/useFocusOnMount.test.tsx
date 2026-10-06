// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextInput } from "react-native";
import { PresentationReadyContext } from "@/contexts/Portal/PresentationContext";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("input presentation readiness", () => {
  it("waits for the native modal window and the mounting commit before focusing", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const focus = vi.fn();
    const ref = { current: { focus, isFocused: () => false } as unknown as TextInput };
    let ready = false;
    const { rerender, unmount } = renderHook(() => useFocusOnMount(ref, true), {
      wrapper: ({ children }) => <PresentationReadyContext.Provider value={ready}>{children}</PresentationReadyContext.Provider>,
    });
    expect(frames.size).toBe(0);
    ready = true;
    rerender();
    const runFrame = () => {
      const pending = [...frames.values()]; frames.clear();
      act(() => pending.forEach((callback) => callback(0)));
    };
    runFrame();
    expect(focus).not.toHaveBeenCalled();
    runFrame();
    expect(focus).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("cancels queued focus when the form is removed during rapid navigation", () => {
    const queued = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { queued.set(1, callback); return 1; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => queued.delete(id));
    const focus = vi.fn();
    const ref = { current: { focus, isFocused: () => false } as unknown as TextInput };
    const { unmount } = renderHook(() => useFocusOnMount(ref, true));
    expect(queued.size).toBe(1);
    unmount();
    expect(queued.size).toBe(0);
    expect(focus).not.toHaveBeenCalled();
  });
});
