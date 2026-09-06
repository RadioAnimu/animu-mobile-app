import { z } from "zod";

// ─── LRCLIB ───
//
// Free, key-less lyrics provider (https://lrclib.net) carrying synced
// LRC for a large share of anime openings/endings. Two endpoints:
// `/api/search` (fuzzy, returns many rows) and `/api/get` (exact match
// by title+artist+duration). Responses are validated at the boundary —
// the provider is community data and returns junk rows regularly.
//
// The public server is famously bursty under load (nginx rate limiting,
// 503/504 storms reported upstream), so every request retries transient
// failures with a short backoff before the caller sees an error.

const BASE_URL = "https://lrclib.net/api";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export const CandidateSchema = z.object({
  id: z.number(),
  trackName: z.string().catch(""),
  artistName: z.string().catch(""),
  albumName: z.string().catch(""),
  duration: z.coerce.number().catch(0),
  instrumental: z.boolean().catch(false),
  plainLyrics: z.string().nullable().catch(null),
  syncedLyrics: z.string().nullable().catch(null),
});

export type CandidateDTO = z.infer<typeof CandidateSchema>;

export class LrcLibError extends Error {
  /** HTTP status when the failure came from a response, else undefined. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LrcLibError";
    this.status = status;
  }
}

/**
 * Minimal structural fetch type — the real transport is `expo/fetch`
 * (native OkHttp stack that survives backgrounding); tests inject stubs.
 */
export type FetchLike = (
  input: string,
  init?: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type SearchParams = {
  trackName?: string;
  artistName?: string;
  q?: string;
};

export type ExactParams = {
  trackName: string;
  artistName: string;
  albumName?: string;
  durationSec?: number;
};

/** Response row mapped to the matcher's input type. */
export type LrcLibCandidate = CandidateDTO & { durationSec: number | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class LrcLibClient {
  private readonly fetchImpl: FetchLike;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryBaseMs: number;

  constructor(options: {
    fetchImpl: FetchLike;
    userAgent: string;
    timeoutMs?: number;
    retries?: number;
    retryBaseMs?: number;
  }) {
    this.fetchImpl = options.fetchImpl;
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.retryBaseMs = options.retryBaseMs ?? 700;
  }

  /** Fuzzy search — returns only rows carrying at least one lyric body. */
  async search(params: SearchParams): Promise<LrcLibCandidate[]> {
    const query = new URLSearchParams();
    if (params.trackName) query.set("track_name", params.trackName);
    if (params.artistName) query.set("artist_name", params.artistName);
    if (params.q) query.set("q", params.q);

    const rows = await this.getJson(`${BASE_URL}/search?${query.toString()}`);
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => this.toCandidate(row))
      .filter((row): row is LrcLibCandidate => row !== null);
  }

  /** Exact lookup; resolves null on 404 (the provider's "not found"). */
  async getExact(params: ExactParams): Promise<LrcLibCandidate | null> {
    const query = new URLSearchParams({
      track_name: params.trackName,
      artist_name: params.artistName,
    });
    if (params.albumName) query.set("album_name", params.albumName);
    if (params.durationSec != null) {
      query.set("duration", String(Math.round(params.durationSec)));
    }

    const row = await this.getJson(`${BASE_URL}/get?${query.toString()}`, {
      allowNullOn404: true,
    });
    if (!row) return null;
    return this.toCandidate(row);
  }

  private toCandidate(row: unknown): LrcLibCandidate | null {
    const parsed = CandidateSchema.safeParse(row);
    if (!parsed.success) return null;
    const dto = parsed.data;
    return {
      ...dto,
      durationSec: dto.duration > 0 ? dto.duration : null,
    };
  }

  /**
   * GET with timeout, retryable transient failures (429/5xx and network
   * errors) and exponential delay between attempts.
   */
  private async getJson(
    url: string,
    { allowNullOn404 = false }: { allowNullOn404?: boolean } = {},
  ): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) {
        await sleep(this.retryBaseMs * Math.pow(2, attempt - 1));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": this.userAgent,
          },
          signal: controller.signal,
        });

        if (response.status === 404 && allowNullOn404) return null;
        if (!response.ok) {
          throw new LrcLibError(
            `LRCLIB request failed (${response.status})`,
            response.status,
          );
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        const retryable =
          !(error instanceof LrcLibError) || RETRYABLE_STATUS.has(error.status ?? 0);
        if (!retryable || attempt >= this.retries) break;
      } finally {
        clearTimeout(timer);
      }
    }

    if (lastError instanceof LrcLibError) throw lastError;
    throw new LrcLibError(
      lastError instanceof Error ? lastError.message : "LRCLIB request failed",
    );
  }
}
