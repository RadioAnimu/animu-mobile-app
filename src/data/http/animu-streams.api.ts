import axios from "axios";
import { API } from "../../api";
import { Stream } from "../../core/domain/stream";
import { CONFIG } from "../../utils/player.config";

/**
 * Standalone HTTP client for fetching available radio streams.
 *
 * – Has its own axios instance (independent of the main animu API client).
 * – Caches the result in memory for the entire app session.
 * – Falls back to the hardcoded FALLBACK_STREAM_OPTIONS on any error.
 */

const client = axios.create({
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

let cachedStreams: Stream[] | null = null;

export async function fetchStreams(forceRefresh = false): Promise<Stream[]> {
  if (cachedStreams && !forceRefresh) {
    return cachedStreams;
  }

  try {
    const { data } = await client.get<Stream[]>(API.STREAMS_URL);

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

    console.log(
      "[StreamsAPI] Loaded",
      cachedStreams.length,
      "streams from API",
    );
    return cachedStreams;
  } catch (error) {
    console.warn("[StreamsAPI] Fetch failed, using fallback:", error);
    cachedStreams = CONFIG.FALLBACK_STREAM_OPTIONS;
    return cachedStreams;
  }
}
