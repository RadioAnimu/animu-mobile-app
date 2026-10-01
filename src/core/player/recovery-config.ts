// Tuning for the player's reconnect / stall / resync behaviour.

// ── Stream reconnect backoff ──
/** Base delay between stream reconnect attempts (ms) — doubles each retry */
export const BASE_RECONNECT_DELAY_MS = 2000;
/** Max delay between stream reconnect attempts (ms) */
export const MAX_RECONNECT_DELAY_MS = 30_000;
/**
 * Grace period after a transport transition before an idle/failed native
 * status is treated as a dead stream. Filters transient native states:
 * e.g. replace() emits a brief ExoPlayer "idle" before play() starts
 * buffering. Real stream deaths (ExoPlayer retry exhaustion, AVPlayer
 * .failed) always arrive after their internal retry windows.
 */
export const STREAM_DEATH_GRACE_MS = 3000;
/**
 * Minimum stall (ms) after which resuming audio is treated as "fell behind
 * the live point" and the source is re-opened. A live stream is realtime:
 * every second spent buffering is a second behind live, and the native
 * player drains that stale buffer on recovery instead of snapping back.
 * Below this threshold the blip is left to the native player's own
 * recovery so sub-second hiccups don't churn the connection.
 */
export const LIVE_STALL_REOPEN_MS = 2000;
/**
 * Maximum time (ms) the transport may stay in `connecting` before a fresh
 * native start is forced. A radio must never sit silently (iOS `AVPlayer`
 * can ignore a start issued before its item is ready, and a lost
 * ready-notification would otherwise leave the UI on "paused" forever).
 */
export const CONNECTING_WATCHDOG_MS = 4000;
/**
 * Consecutive watchdog windows spent in `connecting` after which the source
 * itself is re-opened, not just resumed. AVPlayer never recovers a broken
 * progressive (ICY) socket by itself — a stalled connection can sit in
 * "waiting to play" forever, and `resume()` on that dead item does nothing.
 * Three windows (~12s) is well past any healthy cold start.
 */
export const CONNECTING_REOPEN_WINDOWS = 3;
/**
 * Silence (ms) after the last native status frame while the state machine
 * still claims `playing` before the frame is treated as a stall.
 *
 * While a stream FLOWS, AVPlayer's periodic time observer emits a frame every
 * tick — but it stops the instant the playhead freezes, so a network death
 * can leave JS with NO frame at all: no `isBuffering`, no dead state, nothing.
 * The state machine then stays `playing` forever and every recovery gate
 * keyed on "not playing" stays closed (the tunnel bug: iOS starts its
 * suspension countdown because the app renders silence, and once suspended
 * the JS chain never runs again). A 5s gap is impossible for a healthy
 * 1 Hz-playing transport, so silence itself is the stall signal.
 */
export const SILENT_STALL_MS = 5000;
/**
 * Same detector, tightened while the network is suspect (it just dropped,
 * came back or changed transport): the socket is then likely dead and every
 * second of waiting is audible silence.
 */
export const SUSPECT_SILENT_STALL_MS = 2500;
/** How long after a network event the link is treated as suspect (ms). */
export const NETWORK_SUSPECT_MS = 20_000;
/**
 * A stall that outlasts this while the network is reachable means the socket
 * is dead, not slow: AVPlayer/ExoPlayer never revive a broken progressive
 * stream, so waiting for the 12s connecting watchdog just prolongs silence.
 * The source is re-opened at the live edge instead.
 */
export const STALL_REOPEN_ONLINE_MS = 3000;
/** Same, while the network is suspect (see {@link NETWORK_SUSPECT_MS}). */
export const SUSPECT_STALL_REOPEN_MS = 1000;
/**
 * How long a dead native state (idle/failed/ended) must persist — past the
 * death grace window — before a reconnect is scheduled from the heartbeat.
 * Native emits a dead state once, not repeatedly, so a frame that landed
 * inside the grace window would otherwise be lost and only the slow watchdog
 * would notice.
 */
export const DEAD_LATCH_MS = 1000;
/**
 * While the platform reports no connectivity, reconnect attempts are skipped
 * (they only churn the native player and reset the sync clock). Every Nth
 * skipped attempt is made anyway as a probe, in case the OS reading is stale.
 */
export const OFFLINE_PROBE_EVERY = 3;
/**
 * How old the last measurement may be before a resume is treated as stale and
 * the clock is re-synced. A stream that was paused (or suspended in the
 * background) past this window is re-opened at the live edge, so the retained
 * lag is re-measured rather than trusted — a short pause stays seamless.
 */
export const RESYNC_AFTER_MS = 15_000;

/**
 * How long a user pause may keep the stream connection open before it is
 * released. Every resume re-opens the source at the live edge, so what a
 * paused transport keeps downloading (a full-rate audio stream, ~40 KB/s at
 * 320 kbps) is never played — it only holds the radio awake and spends data.
 */
export const PAUSE_RELEASE_MS = 30_000;
