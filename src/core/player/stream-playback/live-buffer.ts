/**
 * Preferred forward buffer duration (seconds) for the live radio stream.
 *
 * Platform-resolved: Android's ExoPlayer already opens live streams at the
 * live edge, so it sets no cap; iOS overrides this in `live-buffer.ios.ts`
 * to make AVPlayer start without waiting to minimise stalling. The default
 * lets any other target decide.
 */
export const LIVE_FORWARD_BUFFER_SECONDS = 0;
