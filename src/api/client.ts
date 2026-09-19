import { AnimuApi, type ArtworkQuality } from "animu-api";
import { fetch as expoFetch } from "expo/fetch";
import { CONFIG } from "@/utils/player.config";
import { CLIENT_INFO } from "@/utils/client-context";

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
  fetchImpl: expoFetch,
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
): AnimuApi =>
  new AnimuApi({
    clientInfo: CLIENT_INFO,
    defaultCover,
    artworkQuality,
    fetchImpl: expoFetch,
  });
