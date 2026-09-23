import { AnimuApi, type ArtworkQuality } from "animu-api";
import { fetch as expoFetch } from "expo/fetch";
import { serverSkewFromDate } from "@/api/server-skew";
import { CONFIG } from "@/utils/player.config";
import { CLIENT_INFO } from "@/utils/client-context";

/**
 * Sink for the server-vs-device clock offset observed on each HTTP response.
 * The player registers the sync engine here; no extra requests are made —
 * every existing call (metadata poll, program, history, SSE connect) carries
 * a `date` header that already tells us the server's clock.
 */
let serverSkewListener: ((skewMs: number) => void) | null = null;

/** Registers (or clears) the server-skew sink. */
export const setServerSkewListener = (
  listener: ((skewMs: number) => void) | null,
): void => {
  serverSkewListener = listener;
};

/**
 * `expo/fetch` wrapped to feed every response's `date` header to the sync
 * engine's clock correction. Everything else is passed through untouched.
 */
const clockAwareFetch: typeof expoFetch = async (...args) => {
  const sentAtMs = Date.now();
  const response = await expoFetch(...args);
  const receivedAtMs = Date.now();
  const skew = serverSkewFromDate(
    response.headers.get("date"),
    sentAtMs,
    receivedAtMs,
  );
  if (skew != null) serverSkewListener?.(skew);
  return response;
};

/**
 * Player-scoped cancellation. The now-playing watchdog must cut ONLY the
 * player's own stalled metadata/history/program sockets on a bad network.
 * The package's `abortAllInFlightRequests()` is process-global and would also
 * kill an in-flight login, avatar upload or music request happening at the
 * same moment. Player clients get the wrapper below, which links the
 * package's per-request signal to this scope; every other client keeps the
 * package's own timeout/abort behaviour untouched.
 */
let playerScope = new AbortController();

/** Aborts only requests issued by player-scoped clients; re-arms for the next poll. */
export const abortPlayerRequests = (): void => {
  playerScope.abort();
  playerScope = new AbortController();
};

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
 * Shared client for everything whose settings don't change per call:
 * program, history, music/live requests, streams, auth.
 *
 * The package owns schemas, mappers and transport (timeouts, micro-cache,
 * error taxonomy). This file is the app's single integration point — if the
 * package API changes, adapt here, not in the services.
 *
 * Uses `expo/fetch` instead of React Native's global fetch: its dedicated
 * native OkHttp stack keeps working while the app is backgrounded and
 * cancels hung calls natively — RN's `NetworkingModule` pool wedges in the
 * background, freezing now-playing metadata updates.
 */
export const animuApi = new AnimuApi({
  clientInfo: CLIENT_INFO,
  defaultCover: CONFIG.DEFAULT_COVER,
  fallbackStreams: CONFIG.FALLBACK_STREAM_OPTIONS,
  fetchImpl: clockAwareFetch,
});

/**
 * Builds a client whose per-call options (artwork quality, default cover) are
 * runtime user/resolver state rather than the shared client's module-load
 * defaults. Callers that need them — now-playing metadata, history rows, the
 * live SSE surface, and request search — each get their own lightweight,
 * otherwise-stateless instance (the package keeps only a short-lived HTTP
 * micro-cache, which the player's 5s polling doesn't depend on).
 *
 * The SSE surface is reached through the returned client's `.live` accessor;
 * it is long-lived (no request timeout) and survives backgrounding via
 * `expo/fetch`'s native OkHttp stack, the same reason the shared client uses
 * it. Search rows carry every size the station exposes and the mapper picks
 * per `artworkQuality` — the SAME setting that selects the now-playing cover,
 * so a searched and later-played song shares the same URL family (disk-cache
 * life).
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
  });
