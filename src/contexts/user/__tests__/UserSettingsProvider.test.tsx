// @vitest-environment jsdom
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_USER_SETTINGS } from "@/constants/settings";
import {
  UserSettingsProvider,
  useUserSettings,
} from "@/contexts/user/UserSettingsProvider";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  updateSettings: vi.fn(),
  clearAll: vi.fn(),
  trim: vi.fn(),
  updateLiveStreamLifecycle: vi.fn(),
  setVisualizerEnabled: vi.fn(),
}));

vi.mock("@/core/services/user-settings.service", () => ({
  userSettingsService: {
    initialize: mocks.initialize,
    updateSettings: mocks.updateSettings,
  },
}));
vi.mock("@/core/services/cover-disk-storage.service", () => ({
  coverDiskStorage: { clearAll: mocks.clearAll, trim: mocks.trim },
}));
vi.mock("@/core/player", () => ({
  playerService: () => ({
    updateLiveStreamLifecycle: mocks.updateLiveStreamLifecycle,
    setVisualizerEnabled: mocks.setVisualizerEnabled,
  }),
}));

describe("useUserSettings outside a provider", () => {
  it("exposes the defaults", () => {
    const { result } = renderHook(() => useUserSettings());
    expect(result.current.settings).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("rejects updates and resets with an Error (not a bare string)", async () => {
    const { result } = renderHook(() => useUserSettings());

    const update = await result.current
      .updateSettings({ hapticsEnabled: false })
      .catch((e: unknown) => e);
    const reset = await result.current.resetSettings().catch((e: unknown) => e);

    expect(update).toBeInstanceOf(Error);
    expect((update as Error).message).toBe("Settings not initialized");
    expect(reset).toBeInstanceOf(Error);
    expect((reset as Error).message).toBe("Settings not initialized");
  });
});

describe("UserSettingsProvider", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserSettingsProvider>{children}</UserSettingsProvider>
  );

  beforeEach(() => {
    mocks.initialize.mockResolvedValue({
      ...DEFAULT_USER_SETTINGS,
      hapticsEnabled: false,
    });
    mocks.updateSettings.mockResolvedValue(undefined);
    mocks.clearAll.mockResolvedValue(undefined);
    mocks.trim.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the stored settings and wires the player to them", async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper });

    await waitFor(() => expect(result.current.settings.hapticsEnabled).toBe(false));
    expect(mocks.setVisualizerEnabled).toHaveBeenCalledWith(true);
    expect(mocks.updateLiveStreamLifecycle).toHaveBeenCalled();
  });

  it("merges a partial update, persists it, and applies it", async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings.hapticsEnabled).toBe(false));

    await act(async () => {
      await result.current.updateSettings({ visualizerHz: 0 });
    });

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      ...DEFAULT_USER_SETTINGS,
      hapticsEnabled: false,
      visualizerHz: 0,
    });
    expect(result.current.settings.visualizerHz).toBe(0);
    expect(mocks.setVisualizerEnabled).toHaveBeenLastCalledWith(false);
  });

  it("keeps the previous settings when persisting fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings.hapticsEnabled).toBe(false));
    mocks.updateSettings.mockRejectedValueOnce(new Error("disk"));

    await act(async () => {
      await result.current.updateSettings({ visualizerHz: 0 });
    });

    expect(result.current.settings.visualizerHz).toBe(DEFAULT_USER_SETTINGS.visualizerHz);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("wipes the cover cache when caching is turned off", async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings.hapticsEnabled).toBe(false));

    await act(async () => {
      await result.current.updateSettings({ cacheEnabled: false });
    });

    expect(mocks.clearAll).toHaveBeenCalledTimes(1);
    expect(result.current.settings.cacheEnabled).toBe(false);
  });

  it("reset restores the defaults", async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings.hapticsEnabled).toBe(false));

    await act(async () => {
      await result.current.resetSettings();
    });

    expect(mocks.updateSettings).toHaveBeenCalledWith(DEFAULT_USER_SETTINGS);
    expect(result.current.settings).toEqual(DEFAULT_USER_SETTINGS);
  });
});
