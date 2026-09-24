/**
 * Preferred forward buffer duration (seconds) for the live radio stream.
 *
 * Deliberately `0` (the native system default) on BOTH platforms:
 *
 * - Android (ExoPlayer) already opens live streams at the live edge, and a
 *   cap here would only touch its load control — keep the system default.
 * - iOS (AVPlayer): it is tempting to cap
 *   `AVPlayerItem.preferredForwardBufferDuration` to ~1s for a lower live
 *   latency, but on these ICY/progressive relays a cap makes AVPlayer pause
 *   and resume the download in bursts: it then holds a deep *internal*
 *   buffer while `loadedTimeRanges` only exposes the small slice between
 *   pauses. The sync engine measures the listener's lag from
 *   `loadedTimeRanges`, so a capped buffer reads ~1–2s while the speaker is
 *   actually ~10s behind — the UI runs ahead of the audio by the
 *   difference. With the system default the loaded range grows
 *   continuously and tracks the true download head (measured on-device:
 *   ~5s on 320 kbps MP3, ~6s on 192, ~16s on 64 kbps AAC+), so the reported
 *   lag matches what is heard. Fast startup is handled independently by the
 *   native patch turning `automaticallyWaitsToMinimizeStalling` off, which
 *   is re-applied on every `replace()` (reconnect / stream change).
 */
export const LIVE_FORWARD_BUFFER_SECONDS = 0;
