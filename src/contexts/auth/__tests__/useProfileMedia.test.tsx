// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProfileMedia } from "@/contexts/auth/useProfileMedia";
import type { AuthProfile } from "animu-api";
import type { User } from "@/core/domain/user";

const svc = vi.hoisted(() => ({
  getCachedProfileMedia: vi.fn(),
  syncProfileMedia: vi.fn(),
}));
vi.mock("@/core/services/profile-media.service", () => svc);

const user = {
  id: 7,
  sessionToken: "tok",
  avatarUrl: "https://a/avatar",
} as unknown as User;
const profile = { banner: { url: "https://a/banner" } } as AuthProfile;

beforeEach(() => {
  svc.getCachedProfileMedia.mockImplementation(
    (kind: string) => `file:///saved-${kind}`,
  );
  svc.syncProfileMedia.mockImplementation(
    async (kind: string) => `file:///fresh-${kind}`,
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useProfileMedia", () => {
  it("shows the saved copies first, then swaps in the synced ones", async () => {
    const { result } = renderHook(() => useProfileMedia(user, profile, 0));
    expect(result.current).toEqual({
      avatar: "file:///saved-avatar",
      banner: "file:///saved-banner",
    });
    await waitFor(() =>
      expect(result.current).toEqual({
        avatar: "file:///fresh-avatar",
        banner: "file:///fresh-banner",
      }),
    );
  });

  it("re-syncs when the image version is bumped (profile refresh)", async () => {
    const { rerender } = renderHook(
      ({ version }) => useProfileMedia(user, profile, version),
      { initialProps: { version: 0 } },
    );
    await waitFor(() => expect(svc.syncProfileMedia).toHaveBeenCalledTimes(2));
    rerender({ version: 1 });
    await waitFor(() => expect(svc.syncProfileMedia).toHaveBeenCalledTimes(4));
  });

  it("does not touch the banner before the profile loads", async () => {
    renderHook(() => useProfileMedia(user, null, 0));
    await waitFor(() => expect(svc.syncProfileMedia).toHaveBeenCalledTimes(1));
    expect(svc.syncProfileMedia).toHaveBeenCalledWith(
      "avatar",
      7,
      "https://a/avatar",
      "tok",
    );
  });

  it("is empty and idle when signed out", () => {
    const { result } = renderHook(() => useProfileMedia(null, null, 0));
    expect(result.current).toEqual({ avatar: null, banner: null });
    expect(svc.syncProfileMedia).not.toHaveBeenCalled();
  });
});
