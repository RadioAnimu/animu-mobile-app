/**
 * Android needs no forward-buffer cap — ExoPlayer already opens a live
 * stream at the live edge, and passing a value would only touch its load
 * control. Keep the platform default (system decides).
 */
export const LIVE_FORWARD_BUFFER_SECONDS = 0;
