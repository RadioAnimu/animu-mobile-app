import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MusicRequestPagination } from "@/core/domain/music-request";
import type { MusicRequestSubmission } from "animu-api";
import { musicRequestService } from "@/core/services/music-request.service";

// Hoisted so the `vi.mock` factories below can reference them (the factories
// run before module-level `const`s are initialized).
const { api, createApiClient } = vi.hoisted(() => {
  const api = {
    searchMusic: vi.fn(),
    searchMusicByTitle: vi.fn(),
    submitMusicRequest: vi.fn(),
  };
  const createApiClient = vi.fn((_quality: unknown) => api);
  return { api, createApiClient };
});

vi.mock("@/api/client", () => ({
  animuApi: { submitMusicRequest: api.submitMusicRequest },
  createApiClient: (quality: unknown) => createApiClient(quality),
}));

vi.mock("@/core/services/user-settings.service", () => ({
  userSettingsService: {
    getCurrentSettings: () => ({ liveQualityCover: "medium" }),
  },
}));

const submission = { trackId: 1 } as unknown as MusicRequestSubmission;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MusicRequestService", () => {
  it("searches with a client carrying the user's cover quality", async () => {
    const page = { items: [] } as unknown as MusicRequestPagination;
    const params = { server: 1, query: "naruto" };
    api.searchMusic.mockResolvedValue(page);

    await expect(musicRequestService.searchTracksByQuery(params)).resolves.toBe(
      page,
    );
    expect(createApiClient).toHaveBeenCalledWith("medium");
    expect(api.searchMusic).toHaveBeenCalledWith(params);
  });

  it("returns the structured submission result", async () => {
    const result = { success: true } as const;
    api.submitMusicRequest.mockResolvedValue(result);

    await expect(musicRequestService.submitRequest(submission)).resolves.toBe(
      result,
    );
  });

  it("normalizes a thrown network failure to REQUEST_ERROR", async () => {
    api.submitMusicRequest.mockRejectedValue(new Error("offline"));

    await expect(musicRequestService.submitRequest(submission)).resolves.toEqual({
      success: false,
      error: "REQUEST_ERROR",
    });
  });
});
