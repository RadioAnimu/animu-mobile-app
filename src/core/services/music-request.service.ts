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
  const t = DICT[lang];
  const withDetail = (template: string) =>
    template.replace("{detail}", detail ?? "");

  // Server sends raw lowercase spellings (`erro: "harublock"`); the package
  // normalizes known blocks to uppercased codes — match both.
  switch (error?.toUpperCase()) {
    case "PEDIBLOCK":
      return detail
        ? t.REQUEST_ERROR_PEDIBLOCK.replace(
            "{time}",
            new Date(detail + "Z").toLocaleTimeString(),
          )
        : t.REQUEST_ERROR_PEDIBLOCK_RECENT;
    case "ANIBLOCK":
    case "ARTISTBLOCK":
      return withDetail(t.REQUEST_ERROR_BLOCK_90);
    case "HARUBLOCK":
      return t.REQUEST_ERROR_HARUBLOCK;
    case "STRIKE AND OUT":
    case "STRIKE_AND_OUT":
      return t.ERROR_STRIKE_AND_OUT;
    case "ONAIR":
      return t.REQUEST_ERROR_ONAIR;
    case "BLOCOBLOCK":
      return t.REQUEST_ERROR_BLOCOBLOCK;
    case "NOLOGIN":
      return t.REQUEST_ERROR_NOLOGIN;
    case "NO2FA":
      return t.REQUEST_ERROR_NO2FA;
    case "PANEL_UNAVAILABLE":
      return t.REQUEST_ERROR_PANEL;
    default:
      return t.REQUEST_ERROR;
  }
};
