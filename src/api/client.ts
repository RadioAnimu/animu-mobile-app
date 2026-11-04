import { AnimuApi, type ArtworkQuality } from "animu-api";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";
import { asSimpleRequest } from "@/api/browser-request";
import { serverSkewFromDate } from "@/api/server-skew";
import { CONFIG } from "@/utils/player.config";
import { CLIENT_INFO } from "@/utils/client-context";

/**
 * Sink for the server-vs-device clock offset, read from the `date` header of
 * every existing response (no extra requests).
 */
let serverSkewListener: ((skewMs: number, rttMs: number) => void) | null =
  null;

/** Registers (or clears) the server-skew sink. */
export const setServerSkewListener = (
  listener: ((skewMs: number, rttMs: number) => void) | null,
): void => {
  serverSkewListener = listener;
};

/** Mean error of a second-resolution `date` header (it floors). */
const DATE_HEADER_FLOOR_BIAS_MS = 500;

/**
 * `expo/fetch` feeding each response's `date` header to the clock correction
 * (browsers hide it cross-origin, so the web gets none). In a browser the
 * request is also kept CORS-simple (see {@link asSimpleRequest}).
 */
const clockAwareFetch: typeof expoFetch = async (input, init) => {
  const sentAtMs = Date.now();
  const response = await expoFetch(input, Platform.OS === "web" ? asSimpleRequest(init) : init);
  const receivedAtMs = Date.now();
  const skew = serverSkewFromDate(
    response.headers.get("date"),
    sentAtMs,
    receivedAtMs,
  );
  // A cached response (CDN/proxy) carries the `date` of when it was stored,
  // not of now — its "skew" is just its age.
  const cached = response.headers.get("age") != null;
  if (skew != null && !cached) {
    serverSkewListener?.(skew + DATE_HEADER_FLOOR_BIAS_MS, receivedAtMs - sentAtMs);
  }
  return response;
};

/**
 * Player-scoped cancellation: the now-playing watchdog cuts only the player's
 * stalled sockets. The package's `abortAllInFlightRequests()` is global and
 * would also kill a login, upload or music request in flight.
 */
let playerScope = new AbortController();

/** Aborts only requests issued by player-scoped clients; re-arms for the next poll. */
export const abortPlayerRequests = (): void => {
  playerScope.abort();
  playerScope = new AbortController();
};

/**
 * The current player scope's signal, for reads that outlive the fetch (the
 * SSE body after the headers, once `playerScopedFetch` unlinked the scope).
 */
export const playerRequestSignal = (): AbortSignal => playerScope.signal;

/** Runs `clockAwareFetch` with a signal that fires on the package's abort OR the scope's. */
const playerScopedFetch: typeof expoFetch = async (input, init) => {
  const scope = playerScope.signal;
  const sources = [init?.signal, scope].filter(Boolean) as AbortSignal[];
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const source of sources) {
    if (source.aborted) controller.abort();
    // react-doctor-disable-next-line rn-no-dimensions-get -- AbortSignal listener, not Dimensions.
    else source.addEventListener("abort", abort, { once: true });
  }
  try {
    return await clockAwareFetch(input, { ...init, signal: controller.signal });
  } finally {
    for (const source of sources) source.removeEventListener("abort", abort);
  }
};

/**
 * Shared client for calls whose settings don't change per call (program,
 * history, requests, streams, auth). The app's single integration point with
 * the package.
 *
 * `expo/fetch`, not RN's global fetch: its native OkHttp stack keeps working
 * in the background and cancels hung calls, where RN's `NetworkingModule`
 * pool wedges and freezes now-playing updates.
 */
export const animuApi = new AnimuApi({
  clientInfo: CLIENT_INFO,
  defaultCover: CONFIG.DEFAULT_COVER,
  fallbackStreams: CONFIG.FALLBACK_STREAM_OPTIONS,
  fetchImpl: clockAwareFetch,
});

/**
 * The SSE stream is reconnected after this long without a byte: the daemon
 * sends no keep-alive, so a silently dead socket (network handoff, NAT
 * timeout) would wait forever. Well above a normal quiet stretch.
 */
const LIVE_IDLE_TIMEOUT_MS = 90_000;

/**
 * A client for runtime per-call options (artwork quality, default cover):
 * now-playing, history, the live SSE surface (`.live`) and request search.
 * Search uses the same quality as the now-playing cover, so a searched and
 * later-played song share one cached URL.
 */
export const createApiClient = (
  artworkQuality: ArtworkQuality,
  defaultCover: string = CONFIG.DEFAULT_COVER,
  /** `playerScoped` links the client's requests to `abortPlayerRequests()`. */
  options: { playerScoped?: boolean } = {},
): AnimuApi =>
  new AnimuApi({
    clientInfo: CLIENT_INFO,
    defaultCover,
    artworkQuality,
    fetchImpl: options.playerScoped ? playerScopedFetch : clockAwareFetch,
    liveIdleTimeout: LIVE_IDLE_TIMEOUT_MS,
  });
