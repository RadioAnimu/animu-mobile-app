import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MusicRequestPagination } from "@/core/domain/music-request";
import type { MusicRequestSubmission } from "animu-api";
import {
  getSubmissionErrorMessage,
  musicRequestService,
} from "@/core/services/music-request.service";

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

// `@/i18n` pulls the SVG dictionaries (react-native-svg), which this vitest
// setup cannot transform. The service is language-agnostic by design and only
// reads `DICT[lang]`, so the dictionaries are injected as sentinels: the test
// asserts WHICH message key a code maps to, not the copy itself.
vi.mock("@/i18n", () => ({
  DICT: {
    PT: {
      REQUEST_ERROR_PEDIBLOCK: "PEDIBLOCK[{time}]",
      REQUEST_ERROR_PEDIBLOCK_RECENT: "PEDIBLOCK_RECENT",
      REQUEST_ERROR_BLOCK_90: "BLOCK_90[{detail}]",
      REQUEST_ERROR_HARUBLOCK: "HARUBLOCK",
      ERROR_STRIKE_AND_OUT: "STRIKE_AND_OUT",
      REQUEST_ERROR_ONAIR: "ONAIR",
      REQUEST_ERROR_BLOCOBLOCK: "BLOCOBLOCK",
      REQUEST_ERROR_NOLOGIN: "NOLOGIN",
      REQUEST_ERROR_NO2FA: "NO2FA",
      REQUEST_ERROR_PANEL: "PANEL",
      REQUEST_ERROR: "GENERIC",
    },
    EN: { REQUEST_ERROR: "GENERIC_EN" },
  },
}));

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

describe("getSubmissionErrorMessage", () => {
  it("maps each server block code to its message", () => {
    expect(getSubmissionErrorMessage("HARUBLOCK")).toBe("HARUBLOCK");
    expect(getSubmissionErrorMessage("ONAIR")).toBe("ONAIR");
    expect(getSubmissionErrorMessage("BLOCOBLOCK")).toBe("BLOCOBLOCK");
    expect(getSubmissionErrorMessage("NOLOGIN")).toBe("NOLOGIN");
    expect(getSubmissionErrorMessage("NO2FA")).toBe("NO2FA");
    expect(getSubmissionErrorMessage("PANEL_UNAVAILABLE")).toBe("PANEL");
  });

  it("matches raw lowercase spellings the server sends", () => {
    expect(getSubmissionErrorMessage("harublock")).toBe("HARUBLOCK");
    expect(getSubmissionErrorMessage("pediblock")).toBe("PEDIBLOCK_RECENT");
  });

  it("treats ANIBLOCK and ARTISTBLOCK as the same 90-day block", () => {
    expect(getSubmissionErrorMessage("ANIBLOCK", "Naruto")).toBe(
      "BLOCK_90[Naruto]",
    );
    expect(getSubmissionErrorMessage("ARTISTBLOCK", "LiSA")).toBe(
      "BLOCK_90[LiSA]",
    );
  });

  it("interpolates the cooldown time for PEDIBLOCK", () => {
    const message = getSubmissionErrorMessage("PEDIBLOCK", "2026-09-23 21:00:00");
    expect(message).toMatch(/^PEDIBLOCK\[.+\]$/);
    expect(message).not.toContain("{time}");
  });

  it("uses the recent variant of PEDIBLOCK when no detail is given", () => {
    expect(getSubmissionErrorMessage("PEDIBLOCK")).toBe("PEDIBLOCK_RECENT");
  });

  it("accepts both spellings of STRIKE AND OUT", () => {
    expect(getSubmissionErrorMessage("STRIKE AND OUT")).toBe("STRIKE_AND_OUT");
    expect(getSubmissionErrorMessage("strike_and_out")).toBe("STRIKE_AND_OUT");
  });

  it("falls back to the generic message for unknown/absent codes", () => {
    expect(getSubmissionErrorMessage("WHO_KNOWS")).toBe("GENERIC");
    expect(getSubmissionErrorMessage(undefined)).toBe("GENERIC");
  });

  it("honours the requested language dictionary", () => {
    expect(getSubmissionErrorMessage("WHO_KNOWS", undefined, "EN")).toBe(
      "GENERIC_EN",
    );
  });
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
