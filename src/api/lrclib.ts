import type { LyricsCandidate } from "@/core/lyrics/types";
import type { LyricsProvider } from "@/core/lyrics/ports";

// ─── LRCLIB ───
//
// Free, key-less lyrics database (https://lrclib.net) with synced LRC for a
// large share of anime songs. `/api/get` matches title + artist + duration
// (±2 s) exactly; `/api/search` is fuzzy and returns up to 20 rows. Rows are
// community data, so each one is validated here before the matcher sees it.
// Only the station's song names leave the device: no account, no device
// details in the User-Agent.

const BASE_URL = "https://lrclib.net/api";
const TIMEOUT_MS = 10_000;
const RETRIES = 2;
const RETRY_BASE_MS = 600;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** The slice of `fetch` the client needs (expo/fetch in the app, stubs in tests). */
export type FetchLike = (
  input: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class LrcLibError extends Error {
  constructor(
    message: string,
    /** HTTP status when the server answered. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "LrcLibError";
  }
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/** A provider row, or `null` when it is not one. */
export function toCandidate(row: unknown): LyricsCandidate | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  if (typeof value.id !== "number" || !Number.isFinite(value.id)) return null;
  const duration = Number(value.duration);
  return {
    id: value.id,
    trackName: text(value.trackName),
    artistName: text(value.artistName),
    albumName: text(value.albumName),
    durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
    instrumental: value.instrumental === true,
    plainLyrics: optionalText(value.plainLyrics),
    syncedLyrics: optionalText(value.syncedLyrics),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class LrcLibClient implements LyricsProvider {
  constructor(
    private readonly options: {
      fetch: FetchLike;
      userAgent: string;
      timeoutMs?: number;
      retryBaseMs?: number;
    },
  ) {}

  async search(params: { trackName?: string; artistName?: string; q?: string }): Promise<LyricsCandidate[]> {
    const query = new URLSearchParams();
    if (params.trackName) query.set("track_name", params.trackName);
    if (params.artistName) query.set("artist_name", params.artistName);
    if (params.q) query.set("q", params.q);
    const rows = await this.request(`${BASE_URL}/search?${query}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(toCandidate).filter((row): row is LyricsCandidate => row != null);
  }

  /** Exact lookup; `null` is the provider's "no such song" (404). */
  async get(params: { trackName: string; artistName: string; durationSec?: number }): Promise<LyricsCandidate | null> {
    const query = new URLSearchParams({ track_name: params.trackName, artist_name: params.artistName });
    if (params.durationSec != null) query.set("duration", String(Math.round(params.durationSec)));
    return toCandidate(await this.request(`${BASE_URL}/get?${query}`, true));
  }

  /** GET with a timeout; 429/5xx and network failures retry with backoff. */
  private async request(url: string, notFoundIsNull = false): Promise<unknown> {
    const { timeoutMs = TIMEOUT_MS, retryBaseMs = RETRY_BASE_MS } = this.options;
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (attempt > 0) await sleep(retryBaseMs * 2 ** (attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.options.fetch(url, {
          headers: { Accept: "application/json", "User-Agent": this.options.userAgent },
          signal: controller.signal,
        });
        if (notFoundIsNull && response.status === 404) return null;
        if (!response.ok) throw new LrcLibError(`LRCLIB ${response.status}`, response.status);
        return await response.json();
      } catch (error) {
        lastError = error;
        const retryable = !(error instanceof LrcLibError) || RETRYABLE.has(error.status ?? 0);
        if (!retryable) break;
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof LrcLibError) throw lastError;
    throw new LrcLibError(lastError instanceof Error ? lastError.message : "LRCLIB request failed");
  }
}
