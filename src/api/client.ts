import { AnimuApi, type ArtworkQuality } from "animu-api";
import { CONFIG } from "../utils/player.config";

/**
 * Shared client for everything whose settings don't change per call:
 * program, history, music/live requests, streams, auth.
 *
 * The package owns schemas, mappers and transport (timeouts, micro-cache,
 * error taxonomy). This file is the app's single integration point — if the
 * package API changes, adapt here, not in the services.
 */
export const animuApi = new AnimuApi({
  userAgent: CONFIG.USER_AGENT,
  defaultCover: CONFIG.DEFAULT_COVER,
  fallbackStreams: CONFIG.FALLBACK_STREAM_OPTIONS,
});

/**
 * Now-playing metadata is the only call whose artwork quality is a runtime
 * user setting, so it gets a lightweight dedicated client per call. The
 * client is stateless apart from a short-lived HTTP micro-cache, which the
 * player's 5s polling doesn't depend on.
 */
export const createMetadataClient = (artworkQuality: ArtworkQuality): AnimuApi =>
  new AnimuApi({
    userAgent: CONFIG.USER_AGENT,
    defaultCover: CONFIG.DEFAULT_COVER,
    artworkQuality,
  });
