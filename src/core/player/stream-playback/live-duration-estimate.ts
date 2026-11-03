import type { Track } from "@/core/domain/track";

/** A song's identity for its estimate: a replay of a title is a new song. */
const keyOf = (track: Track): string => `${track.raw}|${track.startTime.getTime()}`;

/**
 * A live song's length from its lyrics, for a real song the station sends no
 * duration for. DISPLAY only: the station's `duration` drives the sync — a
 * TV-size row (1:30) against a full cut on air (4:00) must not end the lyrics
 * at 1:30.
 */
export class LiveDurationEstimate {
  /** An answer landed for the song still current: re-read {@link msFor}. */
  onChange: () => void = () => {};
  /** `ms` is `null` while the lookup is pending or found nothing. */
  private estimate: { key: string; ms: number | null } | null = null;
  private disposed = false;

  constructor(private readonly lookup?: (track: Track) => Promise<number | null>) {}

  /** The estimated length of `track`, else 0. */
  msFor(track: Track): number {
    const estimate = this.estimate;
    return estimate?.ms && estimate.key === keyOf(track) ? estimate.ms : 0;
  }

  /**
   * Keeps the estimate on `track` (an estimable song, or null): asked once per
   * song, only while `canAsk` (the foreground: no background network); a late
   * answer for another song is ignored.
   */
  sync(track: Track | null, canAsk: boolean): void {
    const lookup = this.lookup;
    if (!track || !lookup) {
      this.estimate = null;
      return;
    }
    const key = keyOf(track);
    if (this.estimate?.key === key) return;
    if (!canAsk) {
      this.estimate = null;
      return;
    }
    this.estimate = { key, ms: null };
    void lookup(track)
      .then(
        (ms) => ms,
        () => {
          // A failed lookup is forgotten so the next sync asks again; "not
          // found" stays answered.
          if (this.estimate?.key === key) this.estimate = null;
          return null;
        },
      )
      .then((ms) => {
        if (this.disposed || this.estimate?.key !== key) return;
        if (ms == null || !Number.isFinite(ms) || ms <= 0) return;
        this.estimate = { key, ms };
        this.onChange();
      });
  }

  /** The player is torn down: forget the estimate and any answer still out. */
  dispose(): void {
    this.disposed = true;
    this.estimate = null;
  }
}
