// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

const { toast, setStringAsync } = vi.hoisted(() => ({
  toast: vi.fn(),
  setStringAsync: vi.fn(async () => true),
}));

vi.mock("expo-clipboard", () => ({ setStringAsync }));
vi.mock("@/utils/haptics", () => ({ haptics: { select: vi.fn() } }));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ TEXT_COPIED: "copied", TEXT_COPY_FAILED: "failed" }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useCopyToClipboard", () => {
  it("shows the copied toast once the clipboard took the text", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => result.current("hello"));

    expect(setStringAsync).toHaveBeenCalledWith("hello");
    expect(toast).toHaveBeenCalledWith("copied");
  });

  it("says so when the clipboard refuses (a browser can)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setStringAsync.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => result.current("hello", "details copied"));

    expect(toast).toHaveBeenCalledExactlyOnceWith("failed", "error");
  });
});
