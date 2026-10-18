// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaveSettings } from "@/hooks/useSaveSettings";

const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  toast: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ updateSettings: mocks.updateSettings }),
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: { error: mocks.error } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ SETTINGS_SAVE_FAILED: "couldn't save" }),
}));

describe("useSaveSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes a saved change through quietly", async () => {
    mocks.updateSettings.mockResolvedValue(true);
    const { result } = renderHook(() => useSaveSettings());

    await expect(result.current({ hapticsEnabled: false })).resolves.toBe(true);

    expect(mocks.updateSettings).toHaveBeenCalledWith({ hapticsEnabled: false });
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("tells the user when the change could not be saved", async () => {
    mocks.updateSettings.mockResolvedValue(false);
    const { result } = renderHook(() => useSaveSettings());

    await expect(result.current({ hapticsEnabled: false })).resolves.toBe(false);

    expect(mocks.toast).toHaveBeenCalledWith("couldn't save", "error");
    expect(mocks.error).toHaveBeenCalled();
  });
});
