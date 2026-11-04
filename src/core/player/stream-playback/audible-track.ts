import type { Track } from "@/core/domain/track";
import type { Timer } from "@/core/player/timer";
import type { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { trackStartMs } from "@/core/player/stream-playback/track-start";

/** Floor for the deferred-adoption timer (ms), so a zero delay never busy-loops. */
const RECONCILE_FLOOR_MS = 250;
/**
 * Longest a pending track may hold the previous one (ms): a skewed station
 * `startTime` or an offset that never resolves must not pin the old track.
 */
const MAX_PENDING_WAIT_MS = 65_000;
/** Longest the re-tune hold (see {@link AudibleTrackResolver.beginReacquire}) waits for a measurement (ms). */
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
const sameTrack = (a: Track | null, b: Track | null): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return a.raw === b.raw && a.artwork === b.artwork;
};

/**
 * Delays the now-playing display to the moment the new song is heard.
 *
 * The station announces a song the instant it broadcasts it, while the
 * speaker still plays the previous one for the whole stream lag. This keeps
 * the previous track on screen until the announced one reaches the audible
 * clock (`StreamSyncEngine` says *when*, this says *what*);
 * `repository.currentTrack` stays the station's truth.
 *
 * The hold only engages once a lag was measured: without one every
 * announcement is adopted at once.
 */
export class AudibleTrackResolver {
  /**
   * A *deferred* adoption changed the display (boundary timer, heartbeat).
   * Synchronous reconciles report through {@link reconcile}'s return value.
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
  /** A re-tune reset the clock: the on-screen track is held (see {@link beginReacquire}). */
  private reacquire = false;
  /** Wall-clock mark {@link reacquire} was armed (safety-cap anchor). */
  private reacquireSinceMs = 0;

  constructor(private readonly deps: AudibleTrackDeps) {}

  /** The track the listener is currently hearing. */
  get track(): Track | null {
    return this.displayedValue;
  }

  /**
   * Arms the re-tune hold: the displayed track stays until the new relay's
   * lag is measured. On the clock's wall-clock fallback a just-announced item
   * would look audible while the relay is still on the previous song.
   * Idempotent.
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
   * the displayed item is still in the future, so the listener is on the
   * previous one.
   */
  private backtrackIfBehind(): boolean {
    const displayed = this.displayedValue;
    if (!displayed) return false;
    const displayedStart = trackStartMs(displayed);
    if (displayedStart == null) return false;
    if (this.deps.sync.isAudible(displayedStart)) return false;

    const candidate = this.previousValue;
    if (!candidate || sameTrack(candidate, displayed)) return false;
    const start = trackStartMs(candidate);
    if (start == null) return false;
    if (!this.deps.sync.isAudible(start)) return false;

    this.displayedValue = candidate;
    this.previousValue = null;
    this.pending = null;
    this.cancel();
    return true;
  }

  /**
   * Aligns the displayed track with the station's current item; whether the
   * display changed. A still-buffered announcement arms a boundary timer.
   *
   * @param force adopt even a buffered track (the pending safety cap).
   */
  reconcile(force = false): boolean {
    const station = this.deps.getStationTrack();

    if (!station) return this.clearDisplay();

    let changed = false;

    if (this.reacquire) {
      if (this.holdForReacquire(station)) return false;
      changed = this.backtrackIfBehind();
    }

    const start = trackStartMs(station);
    const buffering =
      !force &&
      this.deps.sync.hasMeasurement &&
      start != null &&
      !this.deps.sync.isAudible(start);

    if (buffering && this.displayedValue != null) {
      this.markPending(station);
      this.schedule(start - this.deps.sync.now());
      return changed;
    }

    // Audible, or nothing on screen yet: better shown than nothing.
    this.pending = null;
    this.cancel();
    if (sameTrack(this.displayedValue, station)) return changed;
    this.previousValue = this.displayedValue;
    this.displayedValue = station;
    return true;
  }

  /** The station has no current item: drops everything. Returns whether a track was on screen. */
  private clearDisplay(): boolean {
    const had = this.displayedValue != null;
    this.displayedValue = null;
    this.previousValue = null;
    this.pending = null;
    this.cancel();
    this.reacquire = false;
    return had;
  }

  /** Holds `station` as the pending item, anchoring the cap to its first sighting. */
  private markPending(station: Track): void {
    if (!sameTrack(this.pending, station)) this.pendingSinceMs = this.wallNow();
    this.pending = station;
  }

  /**
   * The re-tune hold: true while it holds the display, false once released
   * (measured, nothing on screen, or past {@link REACQUIRE_MAX_MS}).
   */
  private holdForReacquire(station: Track): boolean {
    const waiting = !this.deps.sync.hasMeasurement && this.displayedValue != null;
    if (waiting && this.wallNow() - this.reacquireSinceMs <= REACQUIRE_MAX_MS) {
      this.markPending(station);
      // No timer: the native frames / heartbeat drive `adoptIfDue`.
      this.cancel();
      return true;
    }
    this.reacquire = false;
    return false;
  }

  /**
   * Adopts a pending track once it crossed the audible boundary. Idempotent;
   * driven by the boundary timer and the native heartbeat.
   */
  adoptIfDue(): void {
    // Before the pending guard: a settled display has no pending item, yet
    // must be re-checked against the new relay's clock.
    if (this.reacquire) {
      if (this.reconcile()) this.onChange();
      return;
    }

    const pending = this.pending;
    if (!pending) return;

    if (this.wallNow() - this.pendingSinceMs > MAX_PENDING_WAIT_MS) {
      if (this.reconcile(true)) this.onChange();
      return;
    }

    const start = trackStartMs(pending);
    if (start == null) {
      if (this.reconcile()) this.onChange();
      return;
    }

    // The lag can shift after arming: an early wake re-arms from the clock.
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
