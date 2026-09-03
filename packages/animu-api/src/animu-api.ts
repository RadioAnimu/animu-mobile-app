import { DEFAULT_COVER, DEFAULT_USER_AGENT, ENDPOINTS, FALLBACK_STREAMS } from "./endpoints.js";
import { AnimuApiError, ValidationError, type RequestResult } from "./errors.js";
import { HttpClient, toFormData } from "./http.js";
import {
  historyFromDTO,
  listenersFromMetadata,
  paginationFromDTO,
  parseSubmissionResponse,
  programFromDTO,
  trackFromMetadata,
  userFromExchangePayload,
  validateLiveRequest,
} from "./mappers.js";
import {
  MusicRequestResponseDTOSchema,
  ProgramDTOSchema,
  StreamListDTOSchema,
  StreamMetadataDTOSchema,
  UserDTOSchema,
} from "./schemas.js";
import type {
  AnimuApiOptions,
  ArtworkQuality,
  HistoryType,
  LiveRequest,
  Listeners,
  MusicRequestPagination,
  MusicSearchParams,
  MusicRequestSubmission,
  Program,
  Stream,
  StreamMetadata,
  TokenExchangeParams,
  Track,
  User,
} from "./types.js";

/**
 * TypeScript client for the Animu radio API.
 *
 * Covers now-playing metadata, programs, track history, music requests,
 * live shout-outs, audio streams and Discord-based authentication.
 *
 * Every response is validated at the boundary (zod schemas) and mapped to
 * domain types. Transport features: per-request timeouts, a short-lived GET
 * micro-cache and uniform {@link AnimuApiError} error wrapping.
 *
 * All methods accept an optional per-call timeout through the underlying
 * {@link HttpClient}; construct with {@link AnimuApiOptions} to customize
 * user agent, artwork quality, default cover and fallback streams.
 *
 * @example
 * ```ts
 * const animu = new AnimuApi({ userAgent: "my-bot/1.0" });
 * const { track, listeners } = await animu.getStreamMetadata();
 * ```
 */
export class AnimuApi {
  private readonly http: HttpClient;
  private readonly artworkQuality: ArtworkQuality;
  private readonly defaultCover: string;
  private readonly fallbackStreams: Stream[];

  private cachedStreams: Stream[] | null = null;

  /** @param options - All fields optional; sensible Animu defaults are built in. */
  constructor(options: AnimuApiOptions = {}) {
    this.http = new HttpClient(
      options.userAgent ?? DEFAULT_USER_AGENT,
      options.timeout ?? 20000,
    );
    this.artworkQuality = options.artworkQuality ?? "medium";
    this.defaultCover = options.defaultCover ?? DEFAULT_COVER;
    this.fallbackStreams = options.fallbackStreams ?? [...FALLBACK_STREAMS];
  }

  // ─── Now playing ────────────────────────────────────────────────────────

  /**
   * Fetches the current track and listener count in a single call to the
   * API base URL.
   *
   * @returns The mapped track (`null` when the payload lacks track data)
   * and the resolved listener count.
   * @throws {AnimuApiError} On network/HTTP failures.
   * @throws {ValidationError} When the payload fails schema validation.
   */
  async getStreamMetadata(): Promise<StreamMetadata> {
    const dto = StreamMetadataDTOSchema.parse(
      await this.http.get<unknown>(ENDPOINTS.api),
    );
    return {
      track: trackFromMetadata(dto, this.artworkQuality, this.defaultCover),
      listeners: listenersFromMetadata(dto as unknown as Record<string, unknown>),
    };
  }

  /**
   * Fetches just the listener count.
   *
   * Convenience for {@link getStreamMetadata}; note it still downloads the
   * full metadata payload.
   */
  async getListeners(): Promise<Listeners> {
    return (await this.getStreamMetadata()).listeners;
  }

  // ─── Program ────────────────────────────────────────────────────────────

  /**
   * Fetches the program currently on air.
   *
   * Malformed server fields degrade to `""` instead of failing; the AutoDJ
   * is normalized to `dj: "Haruka Yuki"` with `isLive: false`.
   *
   * @throws {AnimuApiError} On network/HTTP failures.
   */
  async getProgram(): Promise<Program> {
    const dto = ProgramDTOSchema.parse(
      await this.http.get<unknown>(ENDPOINTS.program),
    );
    return programFromDTO(dto);
  }

  // ─── History ────────────────────────────────────────────────────────────

  /**
   * Fetches track history from the given endpoint.
   *
   * Rows whose title contains "animu" (station jingles) are filtered out;
   * an invalid payload degrades to an empty array.
   *
   * @param type - `"played"` for the latest played tracks, `"requests"` for
   * the latest listener requests.
   * @throws {AnimuApiError} On network/HTTP failures.
   */
  async getTrackHistory(type: HistoryType): Promise<Track[]> {
    const url =
      type === "requests" ? ENDPOINTS.latestRequests : ENDPOINTS.latestPlayed;
    const dto = await this.http.get<unknown>(url);
    return historyFromDTO(dto, type, this.artworkQuality, this.defaultCover);
  }

  // ─── Music requests ─────────────────────────────────────────────────────

  /**
   * Searches the requestable-track database.
   *
   * @param params - Search parameters; reuse `nextPageParams` from a
   * previous result to walk pages.
   * @returns One page of results with pagination info.
   * @throws {AnimuApiError} On network/HTTP failures.
   * @throws {ValidationError} When the response fails schema validation.
   */
  async searchMusic(params: MusicSearchParams): Promise<MusicRequestPagination> {
    const dto = MusicRequestResponseDTOSchema.parse(
      await this.http.get<unknown>(ENDPOINTS.requestSearch, { params: params as unknown as Record<string, string | number | boolean> }),
    );
    return paginationFromDTO(dto, this.defaultCover);
  }

  /**
   * Searches tracks by title using the endpoint's default parameters
   * (`server: 1`, `requestable: true`, `limit: 25`, `offset: 0`).
   *
   * @param title - Full or partial track title to search for.
   */
  async searchMusicByTitle(title: string): Promise<MusicRequestPagination> {
    return this.searchMusic({
      server: 1,
      filter: "",
      query: title,
      requestable: true,
      limit: 25,
      offset: 0,
    });
  }

  /**
   * Submits a music request using an authenticated PHP session.
   *
   * Business errors (rate limits, blocks, expired sessions) are reported in
   * the response body — they are returned as structured
   * {@link RequestResult} data rather than thrown. Use
   * {@link requestResultMessage} to render them.
   *
   * @throws {AnimuApiError} On network/HTTP failures only.
   */
  async submitMusicRequest(
    submission: MusicRequestSubmission,
  ): Promise<RequestResult> {
    const formData = toFormData({
      allmusic: submission.trackId,
      message: submission.message,
      PHPSESSID: submission.sessionId,
    });

    // `mobileapp=1` is a server-side protocol flag required by the
    // submission endpoint — it is not client-specific.
    const response = await this.http.post<string>(
      ENDPOINTS.requestSubmit,
      formData,
      {
        params: { mobileapp: "1" },
        responseType: "text",
      },
    );

    return parseSubmissionResponse(response);
  }

  // ─── Live requests ──────────────────────────────────────────────────────

  /**
   * Validates and submits a live shout-out.
   *
   * The request is validated client-side first (required fields, length
   * limits) — invalid input throws before any network call.
   *
   * @returns `true` only when the server confirms with `"1"`; `false` for
   * any other response or network failure.
   * @throws {ValidationError} When the request fails validation.
   */
  async submitLiveRequest(request: LiveRequest): Promise<boolean> {
    const validation = validateLiveRequest(request);
    if (!validation.success) {
      throw new ValidationError(validation.message, ENDPOINTS.liveRequest);
    }

    const formData = toFormData({
      name: request.name,
      city: request.city,
      artist: request.artist,
      music: request.music,
      anime: request.anime,
      request: request.request ?? "",
    });

    try {
      const data = await this.http.post<string>(
        ENDPOINTS.liveRequest,
        formData,
        { responseType: "text" },
      );
      return data === "1";
    } catch {
      return false;
    }
  }

  // ─── Streams ────────────────────────────────────────────────────────────

  /**
   * Fetches the available audio streams.
   *
   * The list is cached in memory for the lifetime of this instance; an
   * unreachable or invalid endpoint degrades to the fallback stream list
   * (customizable via {@link AnimuApiOptions.fallbackStreams}) instead of
   * throwing.
   *
   * @param forceRefresh - Bypass both the instance cache and the HTTP
   * micro-cache to fetch a fresh list.
   */
  async getStreams(forceRefresh = false): Promise<Stream[]> {
    if (this.cachedStreams && !forceRefresh) {
      return this.cachedStreams;
    }

    try {
      const data = StreamListDTOSchema.parse(
        await this.http.get<unknown>(ENDPOINTS.streams, {
          headers: { "Content-Type": "application/json" },
          noCache: forceRefresh,
        }),
      ).map((s) => ({
        id: s.id,
        bitrate: s.bitrate,
        category: s.category,
        url: s.url,
      }));
      this.cachedStreams = data;
    } catch {
      this.cachedStreams = [...this.fallbackStreams];
    }

    return this.cachedStreams;
  }

  /** Drops the cached stream list (and the underlying HTTP cache), forcing the next {@link getStreams} call to refetch. */
  clearStreamsCache(): void {
    this.cachedStreams = null;
    this.http.clearCache();
  }

  // ─── Auth ───────────────────────────────────────────────────────────────

  /**
   * Checks whether a PHP session id is still valid on the server.
   *
   * @returns `true` only when the server confirms with `"1"`; `false` for
   * any other response or network failure.
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const data = await this.http.get<string>(ENDPOINTS.validateSession, {
        params: { PHPSESSID: sessionId },
        responseType: "text",
      });
      return data === "1";
    } catch {
      return false;
    }
  }

  /**
   * Logs the session out server-side. Best-effort — failures are swallowed
   * and the promise always resolves.
   */
  async logout(sessionId: string): Promise<void> {
    try {
      await this.http.get<string>(ENDPOINTS.logout, {
        params: { PHPSESSID: sessionId },
        responseType: "text",
      });
    } catch {
      // logout is best-effort
    }
  }

  /**
   * Exchanges a Discord OAuth2 authorization code for a validated
   * {@link User}. The PKCE exchange happens on the Animu server — your
   * client secret never touches this library.
   *
   * @param params - Code, redirect URI and PKCE verifier from your OAuth flow.
   * @returns The authenticated user, including the PHP `sessionId` used by
   * authenticated endpoints (`submitMusicRequest`, `validateSession`, `logout`).
   * @throws {AnimuApiError} On network failures, non-JSON responses or
   * server-reported OAuth errors.
   */
  async exchangeToken(params: TokenExchangeParams): Promise<User> {
    let response: Response;
    try {
      response = await fetch(ENDPOINTS.exchangeToken, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: params.code,
          redirect_uri: params.redirectUri,
          code_verifier: params.codeVerifier,
        }).toString(),
      });
    } catch (error) {
      throw new AnimuApiError(
        "Token exchange request failed",
        0,
        { method: "POST", url: ENDPOINTS.exchangeToken },
      );
    }

    const rawText = await response.text();

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new AnimuApiError(
        "Exchange response is not valid JSON",
        response.status,
        { method: "POST", url: ENDPOINTS.exchangeToken },
      );
    }

    const payload = data as { error?: string };
    if (payload.error) {
      throw new AnimuApiError(
        `Token exchange failed: ${payload.error}`,
        response.status,
        { method: "POST", url: ENDPOINTS.exchangeToken },
      );
    }

    return userFromExchangePayload(data);
  }

  // ─── Low-level escape hatch ─────────────────────────────────────────────

  /** Raw HTTP access for endpoints not yet covered by first-class methods. */
  get raw(): HttpClient {
    return this.http;
  }
}
