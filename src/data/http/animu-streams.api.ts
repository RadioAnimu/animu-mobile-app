import { API } from "../../api";
import { Stream } from "../../core/domain/stream";
import { CONFIG } from "../../utils/player.config";

/**
 * Standalone HTTP client for fetching available radio streams.
 *
 * – Caches the result in memory for the entire app session.
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

      data = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(
        "[StreamsAPI] Response was empty or invalid, using fallback",
      );
      cachedStreams = CONFIG.FALLBACK_STREAM_OPTIONS;
      return cachedStreams;
    }

    cachedStreams = data.map((s) => ({
      id: s.id,
      bitrate: s.bitrate,
      category: s.category,
      url: s.url,
    }));

    return cachedStreams;
  } catch (error) {
    console.warn("[StreamsAPI] Fetch failed, using fallback:", error);
    cachedStreams = CONFIG.FALLBACK_STREAM_OPTIONS;
    return cachedStreams;
  }
}
