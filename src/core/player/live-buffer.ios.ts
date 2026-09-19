/**
 * iOS live-stream startup tuning.
 *
 * `AVPlayerItem.preferredForwardBufferDuration` caps how far AVPlayer buffers
 * ahead of the playhead; left at the system default (`0`) a live stream can
 * wait seconds before producing its first sample. One second starts
 * near-instantly while still absorbing ordinary network jitter. The native
 * patch also flips `automaticallyWaitsToMinimizeStalling` off (and re-applies
 * both on every `replace()` reconnect) for the same reason.
 */
export const LIVE_FORWARD_BUFFER_SECONDS = 1;
