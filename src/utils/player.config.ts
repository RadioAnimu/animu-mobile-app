import { Stream } from "../core/domain/stream";

const DEFAULT_COVER: string =
  "https://www.animu.com.br/wp-content/uploads/2022/11/Animu-icon-para-OC.png";

/**
 * Hardcoded fallback streams used when the remote endpoint
 * (https://stream.animu.moe/?json=1) is unreachable.
 * These should rarely be needed — production streams are fetched at startup.
 */
const FALLBACK_STREAM_OPTIONS: Stream[] = [
  {
    id: "320",
    bitrate: 320,
    category: "MP3",
    url: "https://stream.animu.moe/320",
  },
  {
    id: "192",
    bitrate: 192,
    category: "MP3",
    url: "https://stream.animu.moe/192",
  },
  {
    id: "64",
    bitrate: 64,
    category: "AAC+",
    url: "https://stream.animu.moe/64",
  },
];

const DEFAULT_STREAM_OPTION: Stream = FALLBACK_STREAM_OPTIONS[0]; // 320 kbps MP3

const USER_AGENT: string = "Animu Mobile App";

export const CONFIG = {
  FALLBACK_STREAM_OPTIONS,
  DEFAULT_STREAM_OPTION,
  DEFAULT_COVER,
  USER_AGENT,
};
