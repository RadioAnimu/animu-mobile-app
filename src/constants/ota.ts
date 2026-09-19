/**
 * Over-the-air update feed.
 *
 * Updates are published by `.github/workflows/ota.yml`, which keeps a rolling
 * `ota` GitHub Release holding an `update.json` manifest plus one zipped
 * Hermes bundle per platform. The URL below is the stable "latest" asset URL
 * for that release, so the app never needs a redeploy when a new bundle ships.
 */
export const OTA_MANIFEST_URL =
  "https://github.com/RadioAnimu/animu-mobile-app/releases/download/ota/update.json";

/**
 * How many previously downloaded bundles the native side keeps around for
 * rollback. A crash in a freshly applied bundle automatically falls back to
 * the previous one; the oldest entries are evicted past this count.
 */
export const OTA_MAX_BUNDLE_VERSIONS = 3;
