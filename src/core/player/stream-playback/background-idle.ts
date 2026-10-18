/**
 * How long the app may stay in the background with no audio wanted before the
 * station's realtime connection (SSE) and its automatic work are given up.
 *
 * A **best-effort deadline**, enforced at the next point JS runs: React
 * Native's timers are frozen in the background (Android), so nothing fires at
 * the ten-minute mark. What does run is the SSE stream itself — its bytes
 * reach JS in the background — so the repository asks before ingesting each
 * event, and an event after the deadline closes the stream instead of being
 * merged (at most one song change, ~3–4 min, late). Lifecycle changes (app
 * visibility, play/pause) re-evaluate it too.
 */
export const BACKGROUND_IDLE_CUTOFF_MS = 600_000;

/**
 * "The user does not care" clock behind the realtime-connection policy.
 *
 * The app is **idle** when it is hidden (`background` — a transient
 * `inactive` is still visible and never reaches here) AND no audio is wanted
 * (play intent: playing, still buffering, reconnecting, or a `play()` on its
 * way). Either alone proves nothing: a hidden app that is playing is the
 * normal radio use, and a visible one that is paused is a user looking at the
 * screen.
 *
 * The clock starts when *both* hold for the first time and keeps its anchor
 * while they stay true; any end of idleness (foreground, play intent) clears
 * it, so the next idle spell is a fresh ten minutes — a user who paused 20
 * minutes ago in the foreground and only then hides the app gets the full
 * window, not an expired one.
 *
 * Pure bookkeeping: callers feed it the current truth on every lifecycle
 * change and ask before each unit of work. It reads the **device wall clock**
 * (`Date.now`): this is about how long the user has been away, not about the
 * station's timeline, so the server-corrected clock has no place here.
 */
export class BackgroundIdle {
  private appActive = true;
  private playIntent = false;
  private idleSinceMs: number | null = null;

  constructor(private readonly clock: () => number = Date.now) {}

  /**
   * Feeds the current state. Idempotent: repeating the same state keeps the
   * anchor. Returns nothing — read {@link idle} / {@link liveAllowed} after.
   */
  update(appActive: boolean, playIntent: boolean): void {
    this.appActive = appActive;
    this.playIntent = playIntent;
    if (appActive || playIntent) {
      this.idleSinceMs = null;
    } else {
      this.idleSinceMs ??= this.clock();
    }
  }

  /** Hidden with no audio wanted (inside the grace window or past it). */
  get idle(): boolean {
    return !this.appActive && !this.playIntent;
  }

  /** How long the current idle spell has lasted, ms; 0 when not idle. */
  idleForMs(now: number = this.clock()): number {
    return this.idleSinceMs == null ? 0 : Math.max(0, now - this.idleSinceMs);
  }

  /**
   * Whether the realtime connection and the automatic station work may run:
   * always, except once an idle spell has lasted the whole
   * {@link BACKGROUND_IDLE_CUTOFF_MS}.
   */
  liveAllowed(now: number = this.clock()): boolean {
    return !this.idle || this.idleForMs(now) < BACKGROUND_IDLE_CUTOFF_MS;
  }
}
