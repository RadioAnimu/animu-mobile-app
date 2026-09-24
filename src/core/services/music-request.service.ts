import type {
  MusicRequestPagination,
  MusicSearchParams,
} from "@/core/domain/music-request";
import type { RequestSubmitResult } from "@/core/domain/request-result";
import type { MusicRequestSubmission } from "animu-api";
import { DICT, type LanguageKey } from "@/i18n";
import { animuApi, createApiClient } from "@/api/client";
import { interpolate } from "@/utils/format";
import { userSettingsService } from "@/core/services/user-settings.service";

class MusicRequestService {
  /** Re-entrancy latch — mirrors `LiveRequestService` (same double-submit hole: two
      triggers inside one commit both observed `idle` and POSTed twice). */
  private isSubmitting = false;

  /**
   * A fresh client per search carrying the user's cover-quality setting
   * (same preference as now-playing) — mirrors the per-call metadata
   * clients in `animu.service`.
   */
  private api() {
    const settings = userSettingsService.getCurrentSettings();
    return createApiClient(settings.liveQualityCover);
  }

  async searchTracksByQuery(
    params: MusicSearchParams,
  ): Promise<MusicRequestPagination> {
    return this.api().searchMusic(params);
  }

  async searchTracksByTitle(title: string): Promise<MusicRequestPagination> {
    return this.api().searchMusicByTitle(title);
  }

  /**
   * Submits a music request. Business errors (rate limits, blocks, expired
   * sessions) come back as structured data — only network failures throw,
   * and those are normalized to `REQUEST_ERROR`.
   */
  async submitRequest(
    submission: MusicRequestSubmission,
  ): Promise<RequestSubmitResult> {
    // Service-level re-entrancy guard: the UI's idle check reads a closure,
    // so double-tap/Enter-before-re-render could fire this twice. Mirrors
    // `live-request.service`. The cooldown is server-counted — a duplicate
    // POST would spend the user's request window on a PEDIBLOCK.
    if (this.isSubmitting) {
      return { success: false, error: "IN_PROGRESS" };
    }
    try {
      this.isSubmitting = true;
      return await animuApi.submitMusicRequest(submission);
    } catch (error) {
      console.error("Request submission error:", error);
      return {
        success: false,
        error: "REQUEST_ERROR",
      };
    } finally {
      this.isSubmitting = false;
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
    interpolate(template, { detail: detail ?? "" });

  // Server sends raw lowercase spellings (`erro: "harublock"`); the package
  // normalizes known blocks to uppercased codes — match both.
  switch (error?.toUpperCase()) {
    case "PEDIBLOCK":
      return detail
        ? interpolate(t.REQUEST_ERROR_PEDIBLOCK, {
            time: new Date(detail + "Z").toLocaleTimeString(),
          })
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
