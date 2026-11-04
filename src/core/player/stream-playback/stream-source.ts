import { Platform } from "react-native";
import type { Stream } from "@/core/domain/stream";
import { CONFIG } from "@/utils/player.config";

// Safari and Firefox send a User-Agent as a CORS-preflighted header the stream
// server refuses: the fetch fails (no metadata, no oscilloscope). Chrome drops it.
const STREAM_HEADERS: Record<string, string> = Platform.OS === "web" ? {} : { "User-Agent": CONFIG.USER_AGENT };

/**
 * What the player loads for `stream`: every relay as a rendition of one live
 * source, so a quality change has no gap. A stream outside the fetched list
 * (the fallback) plays on its own.
 */
export const streamSource = (streams: Stream[], stream: Stream) => {
  const renditions = streams.some((option) => option.id === stream.id) ? streams : [];
  return {
    uri: stream.url,
    ...(renditions.length > 0 && {
      renditions: renditions.map((option) => ({
        id: option.id,
        uri: option.url,
        bitrate: option.bitrate * 1_000,
      })),
    }),
    live: true,
    headers: STREAM_HEADERS,
  };
};
