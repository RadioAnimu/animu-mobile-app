import { API } from "../../api";
import { CONFIG } from "../../utils/player.config";
import { StreamListDTOSchema } from "./dto/stream.dto";
import { Stream } from "../../core/domain/stream";

/**
 * Standalone HTTP client for fetching available radio streams.
 *
 * – Caches the result in memory for the entire app session.
 * – Validates the payload at the boundary (zod).
 * – Falls back to the hardcoded FALLBACK_STREAM_OPTIONS on any error.
 */

let cachedStreams: Stream[] | null = null;

export async function fetchStreams(forceRefresh = false): Promise<Stream[]> {
  if (cachedStreams && !forceRefresh) {
    return cachedStreams;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let data: Stream[];
    try {
      const response = await fetch(API.STREAMS_URL, {
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      data = StreamListDTOSchema.parse(await response.json()).map((s) => ({
        id: s.id,
        bitrate: s.bitrate,
        category: s.category,
        url: s.url,
      }));
    } finally {
      clearTimeout(timeoutId);
    }

    cachedStreams = data;
    return cachedStreams;
  } catch (error) {
    console.warn("[StreamsAPI] Fetch failed or invalid, using fallback:", error);
    cachedStreams = CONFIG.FALLBACK_STREAM_OPTIONS;
    return cachedStreams;
  }
}
