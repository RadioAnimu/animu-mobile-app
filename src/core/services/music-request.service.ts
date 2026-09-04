import type {
  MusicRequestPagination,
  MusicSearchParams,
} from "../domain/music-request";
import type { MusicRequestSubmission } from "animu-api";
import { DICT, type LanguageKey } from "../../i18n";
import { animuApi } from "../../api/client";

class MusicRequestService {
  async searchTracksByQuery(
    params: MusicSearchParams,
  ): Promise<MusicRequestPagination> {
    return animuApi.searchMusic(params);
  }

  async searchTracksByTitle(title: string): Promise<MusicRequestPagination> {
    return animuApi.searchMusicByTitle(title);
  }

  /**
   * Submits a music request. Business errors (rate limits, blocks, expired
   * sessions) come back as structured data — only network failures throw,
   * and those are normalized to `REQUEST_ERROR`.
   */
  async submitRequest(submission: MusicRequestSubmission): Promise<{
    success: boolean;
    detail?: string;
    error?: string;
  }> {
    try {
      return await animuApi.submitMusicRequest(submission);
    } catch (error) {
      console.error("Request submission error:", error);
      return {
        success: false,
        error: "REQUEST_ERROR",
      };
    }
  }
}

export const musicRequestService = new MusicRequestService();

/**
 * Maps a submission result to a user-facing message (UI/i18n concern —
 * the package intentionally stays language-agnostic).
 */
export const getSubmissionErrorMessage = (
  error?: string,
  detail?: string,
  lang: LanguageKey = "PT",
): string => {
  // Server sends raw lowercase spellings (`erro: "harublock"`); the package
  // normalizes known blocks to uppercased codes — match both.
  switch (error?.toUpperCase()) {
    case "PEDIBLOCK":
      return detail
        ? `This track was already requested. Available again after ${new Date(detail + "Z").toLocaleTimeString()}`
        : "This track was requested too recently.";
    case "ANIBLOCK":
      return `Too many songs from "${detail}" in the last 90 minutes.`;
    case "ARTISTBLOCK":
      return `Too many songs from "${detail}" in the last 90 minutes.`;
    case "HARUBLOCK":
      return "This track was played too recently by the AutoDJ.";
    case "STRIKE AND OUT":
    case "STRIKE_AND_OUT":
      return "You've reached the request limit.";
    case "ONAIR":
      return "Requests are disabled while a DJ is live.";
    case "BLOCOBLOCK":
      return "Requests are currently disabled.";
    case "NOLOGIN":
      return "Your session expired. Please log in again.";
    case "NO2FA":
      return "You need 2FA enabled on Discord to make requests.";
    case "PANEL_UNAVAILABLE":
      return "The radio panel is temporarily unavailable. Try again in a moment.";
    default:
      return DICT[lang].REQUEST_ERROR;
  }
};
