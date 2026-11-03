import type {
  MusicRequestPagination,
  MusicSearchParams,
} from "@/core/domain/music-request";
import type { RequestSubmitResult } from "@/core/domain/request-result";
import type { MusicRequestSubmission } from "animu-api";
import { animuApi, createApiClient } from "@/api/client";
import { userSettingsService } from "@/core/services/user-settings.service";
import { RequestSubmitGuard } from "@/core/services/request-submit-guard";
import {
  listenStatsService,
  type RequestedSong,
} from "@/core/services/listen-stats.service";

class MusicRequestService {
  /** Double-submit latch (see `RequestSubmitGuard`). */
  private readonly guard = new RequestSubmitGuard();

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
    song?: RequestedSong,
  ): Promise<RequestSubmitResult> {
    const result = await this.guard.run(() =>
      animuApi.submitMusicRequest(submission),
    );
    // The single choke point for "requests sent" stats — only
    // server-confirmed submissions count (track id + song details feed the
    // top-requests ranking).
    listenStatsService.onRequestSubmitted(
      result.success,
      submission.trackId,
      song,
    );
    return result;
  }
}

export const musicRequestService = new MusicRequestService();
