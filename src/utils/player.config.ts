import { Stream } from "@/core/domain/stream";
import { DEFAULT_COVER as API_DEFAULT_COVER } from "animu-api";

/**
 * React Native's dev flag — Metro defines it in every bundle (and inlines
 * it as a literal), but it is undefined in plain node (unit tests), so
 * those get `false`. Gates verbose player diagnostics (sampled heartbeat
 * lines, track-change logs): prod logs stay quiet.
 */
declare const __DEV__: boolean | undefined;

const DEBUG: boolean = typeof __DEV__ !== "undefined" ? __DEV__ : false;

/**
 * Single source of truth: the API package's default cover (animu.moe —
 * the same host every other remote URL comes from). Reusing one URL keeps
 * the fallback artwork a single cache entry: an image sourced from a
 * second host (the old .com.br copy here) would cache under a different
 * key and could be downloaded alongside.
 */
const DEFAULT_COVER: string = API_DEFAULT_COVER;

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

/**
 * Stream User-Agent. Starts neutral and is replaced at startup by
 * `utils/client-context` (which needs native modules and therefore can't be
 * imported here — this module is loaded by node unit tests). The structured
 * value is what listener maps display: platform, model, OS and language.
 */
let userAgent = "animu-api";

/** Replaces the stream User-Agent (called once by `client-context`). */
export const setUserAgent = (value: string): void => {
  userAgent = value;
};

export const CONFIG = {
  FALLBACK_STREAM_OPTIONS,
  DEFAULT_STREAM_OPTION,
  DEFAULT_COVER,
  get USER_AGENT(): string {
    return userAgent;
  },
  DEBUG,
};

/**
 * Dev-only trace. Debug chatter (cover resolution, sync math) is verbose and
 * the release console is silent by definition — gate it behind `__DEV__` so
 * production builds ship no logging overhead. Failures keep using
 * `console.warn` directly (worth surfacing regardless of build).
 */
export const debugLog = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args);
};
