// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenReader } from "@/hooks/useScreenReader";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), remove: vi.fn(), change: null as null | ((enabled: boolean) => void) }));
vi.mock("react-native", () => ({ AccessibilityInfo: {
  isScreenReaderEnabled: mocks.enabled,
  addEventListener: (_name: string, callback: (enabled: boolean) => void) => { mocks.change = callback; return { remove: mocks.remove }; },
} }));
beforeEach(() => { mocks.enabled.mockResolvedValue(false); });

describe("screen reader lifecycle", () => {
  it("reads initial state, follows accessibility changes, and removes its subscription", async () => {
    mocks.enabled.mockResolvedValue(true);
    const { result, unmount } = renderHook(useScreenReader);
    await waitFor(() => expect(result.current).toBe(true));
    act(() => mocks.change!(false));
    expect(result.current).toBe(false);
    unmount();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("ignores a late initial response after unmount", async () => {
    let resolve!: (value: boolean) => void;
    mocks.enabled.mockReturnValue(new Promise<boolean>((done) => { resolve = done; }));
    const { unmount } = renderHook(useScreenReader);
    unmount();
    await act(async () => resolve(true));
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("retains a usable fallback when the native initial-state query fails", async () => {
    mocks.enabled.mockRejectedValue(new Error("native unavailable"));
    const { result, unmount } = renderHook(useScreenReader);
    await act(async () => {});
    expect(result.current).toBe(false);
    act(() => mocks.change!(true));
    expect(result.current).toBe(true);
    unmount();
  });
});
