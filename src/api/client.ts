import { AnimuApi, type ArtworkQuality } from "animu-api";
import { fetch as expoFetch } from "expo/fetch";
import { CONFIG } from "../utils/player.config";

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
  userAgent: CONFIG.USER_AGENT,
  defaultCover: CONFIG.DEFAULT_COVER,
  fallbackStreams: CONFIG.FALLBACK_STREAM_OPTIONS,
  fetchImpl: expoFetch,
});

/**
 * Now-playing metadata is the only call whose options (artwork quality,
 * default cover) are runtime user/resolver state, so it gets a lightweight
 * dedicated client per call. The client is stateless apart from a
 * short-lived HTTP micro-cache, which the player's 5s polling doesn't
 * depend on.
 */
export const createMetadataClient = (
  artworkQuality: ArtworkQuality,
  defaultCover: string = CONFIG.DEFAULT_COVER,
): AnimuApi =>
  new AnimuApi({
    userAgent: CONFIG.USER_AGENT,
    defaultCover,
    artworkQuality,
    fetchImpl: expoFetch,
  });
