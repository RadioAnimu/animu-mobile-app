import type { Track } from "@/core/domain/track";
import type { Timer } from "@/core/player/timer";
import type { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";

/**
 * Floor for the deferred-adoption timer (ms). The exact boundary is bounded
 * below by the sync engine's resolution anyway; a tiny floor keeps a
 * zero-delay reading from scheduling a busy loop.
 */
const RECONCILE_FLOOR_MS = 250;
/**
 * Safety cap (ms) on how long a pending track may hold the previous one.
 *
 * Under normal operation the wait is the stream lag (seconds, bounded by the
 * sync engine). But a badly skewed station `startTime` — or a native offset
 * that never resolves — could otherwise pin the display to the old track
 * indefinitely. Past this wall-clock wait the announced track is adopted
 * regardless, so the UI always catches up.
 */
const MAX_PENDING_WAIT_MS = 65_000;
/**
 * Safety cap (ms) on the re-tune re-acquire hold. A relay switch resets the
 * sync engine, so until the new relay's lag is measured a just-announced item
 * must not be adopted on the wall-clock fallback. This bounds that hold in
 * case the new relay never produces a measurement.
 */
const REACQUIRE_MAX_MS = 15_000;

export interface AudibleTrackDeps {
  /** Station-authoritative track (what the station has on air right now). */
  getStationTrack: () => Track | null;
  /** Audible station clock. */
  sync: Pick<StreamSyncEngine, "now" | "isAudible" | "hasMeasurement">;
  timer: Timer;
  /** Wall clock for the pending safety cap; defaults to `Date.now`. */
  nowMs?: () => number;
}

/** Same on-air item, by the identity the repository diffs on. */
const sameTrack = (a: Track | null, b: Track | null): boolean =>
  a === b ||
  (a != null && b != null && a.raw === b.raw && a.artwork === b.artwork);

/**
 * Delays the now-playing display to the moment the listener actually hears
 * the new song.
 *
 * The station announces a `song_change` the instant it starts broadcasting
 * the track, but the speaker is still buffering the previous one. Showing the
 * announcement immediately makes the title/cover/lyrics run ahead of the
 * audio by the whole stream lag. This resolver holds the previous track on
 * screen until the announced one reaches the audible clock, then swaps —
 * so the UI (title, cover, lock screen) flips exactly when the song is heard.
 *
 * It is the display-side counterpart of `StreamSyncEngine`: the engine says
 * *when* a track is audible, this says *what* to render until then. The
 * previous track is retained in memory, so the hand-off is seamless while
 * `repository.currentTrack` stays the station's truth for history/scheduling.
 *
 * Deliberately additive: the hold only engages once the sync engine has
 * actually measured a lag (`hasMeasurement`). With no measurement the
 * resolver adopts every announcement immediately — exactly the pre-sync
 * behaviour — so a platform that cannot measure can never regress the UI.
 */
export class AudibleTrackResolver {
  /**
   * Fired when the displayed track changes from a *deferred* adoption (the
   * boundary timer or a heartbeat re-check). Synchronous reconciles report
   * through {@link reconcile}'s return value, so the orchestrator emits once.
   */
  onChange: () => void = () => {};

  private displayedValue: Track | null = null;
  /** Shown immediately before {@link displayedValue} — the revert source. */
  private previousValue: Track | null = null;
  /** Announced but not yet audible — the track waiting for its boundary. */
  private pending: Track | null = null;
  /** Wall-clock mark the current pending item was first held (cap anchor). */
  private pendingSinceMs = 0;
  private timerId: number | null = null;
  /**
   * A relay switch (or any re-tune) reset the sync clock. Until the new
   * relay's lag is measured, a just-announced item must NOT be adopted on the
   * wall-clock fallback — the newly-selected relay is still several seconds
   * behind on the previous song. While set, the on-screen track is held.
   */
  private reacquire = false;
  /** Wall-clock mark {@link reacquire} was armed (safety-cap anchor). */
  private reacquireSinceMs = 0;

  constructor(private readonly deps: AudibleTrackDeps) {}

  /** The track the listener is currently hearing. */
  get track(): Track | null {
    return this.displayedValue;
  }

  /**
   * Arms the re-tune hold: keep the currently displayed track until the new
   * stream's lag has been measured, instead of flashing the announced item on
   * the sync engine's wall-clock fallback while the new relay is still on the
   * previous song. Idempotent.
   */
  beginReacquire(): void {
    this.reacquire = true;
    this.reacquireSinceMs = this.wallNow();
  }

  private wallNow(): number {
    return this.deps.nowMs?.() ?? Date.now();
  }

  /**
   * Reverts the display when a re-tune landed *behind* the station timeline:
   * the displayed (newer) item is still in the future on the audible clock,
   * so the listener is actually on the previous item (the one retained when
   * the display advanced to the current one).
   */
  private backtrackIfBehind(): boolean {
    const displayed = this.displayedValue;
    if (!displayed) return false;
    const displayedStart = displayed.startTime?.getTime();
    if (displayedStart == null || !Number.isFinite(displayedStart)) return false;
    // Still hearing the displayed item → nothing to revert.
    if (this.deps.sync.isAudible(displayedStart)) return false;

    const candidate = this.previousValue;
    if (!candidate || sameTrack(candidate, displayed)) return false;
    const start = candidate.startTime?.getTime();
    if (start == null || !Number.isFinite(start)) return false;
    // Only revert to something the audible clock says is actually playing.
    if (!this.deps.sync.isAudible(start)) return false;

    this.displayedValue = candidate;
    this.previousValue = null;
    this.pending = null;
    this.cancel();
    return true;
  }

  /**
   * Aligns the displayed track with the station's current item. Returns
   * whether the display changed. When the announced track is still buffered,
   * the previous one is retained and a boundary timer is armed.
   *
   * @param force adopt immediately even if the announced track is buffered
   *   (used by the pending safety cap).
   */
  reconcile(force = false): boolean {
    const station = this.deps.getStationTrack();

    if (!station) {
      const had = this.displayedValue != null;
      this.displayedValue = null;
      this.previousValue = null;
      this.pending = null;
      this.cancel();
      this.reacquire = false;
      return had;
    }

    let changed = false;

    // A re-tune reset the clock. Until the new relay's lag is measured, hold
    // whatever is on screen (its wall-clock fallback would otherwise make a
    // just-announced item look audible when the new relay is still behind).
    if (this.reacquire) {
      if (!this.deps.sync.hasMeasurement && this.displayedValue != null) {
        if (this.wallNow() - this.reacquireSinceMs > REACQUIRE_MAX_MS) {
          this.reacquire = false;
        } else {
          if (!sameTrack(this.pending, station)) {
            this.pendingSinceMs = this.wallNow();
          }
          this.pending = station;
          // No timer: the native frames / heartbeat drive `adoptIfDue`.
          this.cancel();
          return false;
        }
      } else {
        this.reacquire = false;
      }
      // The measurement landed (or nothing was on screen): if the new relay
      // landed *behind* the station timeline, the newer item on screen is
      // still in the future — revert to the one actually playing.
      changed = this.backtrackIfBehind();
    }

    const start = station.startTime?.getTime();
    const timed = start != null && Number.isFinite(start);
    const buffering =
      !force &&
      // Only defer when the lag is actually known — otherwise this is the
      // plain pre-sync behaviour (adopt the announcement immediately).
      this.deps.sync.hasMeasurement &&
      timed &&
      !this.deps.sync.isAudible(start!);

    // Announced ahead of the speaker, with something already on screen:
    // keep the previous track until the new one is heard.
    if (buffering && this.displayedValue != null) {
      if (!sameTrack(this.pending, station)) this.pendingSinceMs = this.wallNow();
      this.pending = station;
      this.schedule(start! - this.deps.sync.now());
      return changed;
    }

    // Audible (or nothing on screen yet — better to show it than nothing).
    this.pending = null;
    this.cancel();
    if (sameTrack(this.displayedValue, station)) return changed;
    this.previousValue = this.displayedValue;
    this.displayedValue = station;
    return true;
  }

  /**
   * Adopts a pending track once it has crossed the audible boundary.
   * Idempotent; driven by the boundary timer and by the native status
   * heartbeat (which keeps it accurate if the lag shifted after arming).
   */
  adoptIfDue(): void {
    // A re-tune is re-locking: let `reconcile` decide — hold until the new
    // lag is measured, then revert/adopt once it lands. Handled BEFORE the
    // pending guard because a settled display has no pending item, yet must
    // still be re-evaluated against the new relay's clock. No timer is armed
    // on the wall-clock fallback (it would busy-loop); the native frames and
    // the heartbeat keep calling this.
    if (this.reacquire) {
      if (this.reconcile()) this.onChange();
      return;
    }

    const pending = this.pending;
    if (!pending) return;

    // Safety net: never hold the previous track past the cap, even if the
    // station start / native offset make the audible boundary unreachable.
    if (this.wallNow() - this.pendingSinceMs > MAX_PENDING_WAIT_MS) {
      if (this.reconcile(true)) this.onChange();
      return;
    }

    const start = pending.startTime?.getTime();
    if (start == null || !Number.isFinite(start)) {
      if (this.reconcile()) this.onChange();
      return;
    }

    // The lag can shift after the boundary was armed (the engine re-locks on
    // a reconnect), so an early wake re-arms from the fresh clock.
    const remaining = start - this.deps.sync.now();
    if (remaining > 0) {
      this.schedule(remaining);
      return;
    }

    if (this.reconcile()) this.onChange();
  }

  /** Clears display + pending state (stream change, teardown). */
  reset(): void {
    this.cancel();
    this.displayedValue = null;
    this.previousValue = null;
    this.pending = null;
    this.pendingSinceMs = 0;
    this.reacquire = false;
    this.reacquireSinceMs = 0;
  }

  private schedule(delayMs: number): void {
    this.cancel();
    this.timerId = this.deps.timer.set(() => {
      this.timerId = null;
      this.adoptIfDue();
    }, Math.max(RECONCILE_FLOOR_MS, delayMs));
  }

  private cancel(): void {
    this.deps.timer.clear(this.timerId);
    this.timerId = null;
  }
}
