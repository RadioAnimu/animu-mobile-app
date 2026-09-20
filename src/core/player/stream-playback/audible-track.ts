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
  /** Announced but not yet audible — the track waiting for its boundary. */
  private pending: Track | null = null;
  /** Wall-clock mark the current pending item was first held (cap anchor). */
  private pendingSinceMs = 0;
  private timerId: number | null = null;

  constructor(private readonly deps: AudibleTrackDeps) {}

  /** The track the listener is currently hearing. */
  get track(): Track | null {
    return this.displayedValue;
  }

  private wallNow(): number {
    return this.deps.nowMs?.() ?? Date.now();
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
      this.pending = null;
      this.cancel();
      return had;
    }

    const start = station.startTime?.getTime();
    const buffering =
      !force &&
      // Only defer when the lag is actually known — otherwise this is the
      // plain pre-sync behaviour (adopt the announcement immediately).
      this.deps.sync.hasMeasurement &&
      start != null &&
      Number.isFinite(start) &&
      !this.deps.sync.isAudible(start);

    // Announced ahead of the speaker, with something already on screen:
    // keep the previous track until the new one is heard.
    if (buffering && this.displayedValue != null) {
      if (!sameTrack(this.pending, station)) this.pendingSinceMs = this.wallNow();
      this.pending = station;
      this.schedule(start! - this.deps.sync.now());
      return false;
    }

    // Audible (or nothing on screen yet — better to show it than nothing).
    this.pending = null;
    this.cancel();
    if (sameTrack(this.displayedValue, station)) return false;
    this.displayedValue = station;
    return true;
  }

  /**
   * Adopts a pending track once it has crossed the audible boundary.
   * Idempotent; driven by the boundary timer and by the native status
   * heartbeat (which keeps it accurate if the lag shifted after arming).
   */
  adoptIfDue(): void {
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
    this.pending = null;
    this.pendingSinceMs = 0;
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
