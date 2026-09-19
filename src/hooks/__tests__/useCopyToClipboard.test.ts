// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

const { toast, setStringAsync } = vi.hoisted(() => ({
  toast: vi.fn(),
  setStringAsync: vi.fn(async () => true),
}));

vi.mock("expo-clipboard", () => ({ setStringAsync }));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ TEXT_COPIED: "copied" }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useCopyToClipboard", () => {
  it("copies the text and shows the copied toast", () => {
    const { result } = renderHook(() => useCopyToClipboard());

    act(() => result.current("hello"));

    expect(setStringAsync).toHaveBeenCalledWith("hello");
    expect(toast).toHaveBeenCalledWith("copied");
  });
});
