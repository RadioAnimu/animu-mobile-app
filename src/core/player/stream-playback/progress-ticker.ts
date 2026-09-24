import { progressStore } from "@/core/player/store";
import type { Track } from "@/core/domain/track";
import type {
  AudioEnginePort,
  MediaSessionPort,
  NowPlayingMetadata,
  RemotePlaybackStatus,
} from "@/core/player/ports";
import type { NowPlayingRepository } from "@/core/player/stream-playback/now-playing.repository";
import {
  getSyncedTrackProgress,
  type StreamSyncEngine,
} from "@/core/player/stream-playback/stream-sync";
import type { TransportStateMachine } from "@/core/player/stream-playback/transport-state";

/** ms → seconds for the native media session, rejecting NaN/Infinity */
export const toSec = (ms: number | null | undefined): number | undefined =>
  ms != null && Number.isFinite(ms) ? ms / 1000 : undefined;

/** Push to the native session every N ticks. */
const NATIVE_POSITION_PUSH_EVERY_TICKS = 3;
/**
 * Cap (ms) on the carry-over advance applied while a freshly-announced track
 * is still buffered. The previous — still-audible — track's bar keeps moving
 * for up to this much, so a long background gap cannot fling it past its end.
 */
const MAX_BOUNDARY_CARRY_MS = 2_000;

export interface ProgressTickerOptions {
  repository: NowPlayingRepository;
  state: TransportStateMachine;
  audio: AudioEnginePort;
  media: MediaSessionPort;
  /**
   * The audible station clock. Progress is resolved against it so the bar,
   * the countdown and the media-session position follow the buffered audio
   * instead of the station's live point.
   */
  sync: Pick<StreamSyncEngine, "now" | "settled">;
  /**
   * The track whose progress is shown — the *audible* track, which may lag
   * the repository's station-current track by the stream buffer. Defaults to
   * the repository's current track when omitted (test fixtures).
   */
  getTrack?: () => Track | null;
  /** Builds fresh metadata (orchestrator supplies cover config). */
  buildMetadata: () => NowPlayingMetadata;
}

/**
 * 1 Hz progress tick, driven by `HeartbeatScheduler`'s ≤1 Hz gate.
 *
 * The heartbeat's two drivers — native `playbackStatusUpdate` events while
 * PLAYING and the JS heartbeat task (paused foreground) — both feed the
 * scheduler, which keeps the data-poll cadence and the watchdog; this unit
 * only owns what ONE tick does:
 *
 * - Updates `progressStore` only when the value actually changed (avoids
 *   1/sec React re-renders).
 * - Resolves progress on the sync engine's audible clock (`Date.now()` minus
 *   the measured stream lag) so the UI follows what is heard, holding at 0
 *   while a freshly-announced track is still buffered.
 * - Detects track end (`getSyncedTrackProgress` → null after the track has
 *   actually ended) and clears the progress UI + native seek bar.
 * - Every Nth tick pushes metadata + status to the media session. With a
 *   seek bar (non-live) the position rides along so the OS can
 *   interpolate it; on LIVE streams there is no bar, so redundant pushes
 *   are skipped unless the metadata itself changed.
 */
export class ProgressTicker {
  private ticks = 0;
  private lastShowProgress = false;
  private lastPushedKey: string | null = null;
  /**
   * Progress of the track shown on the previous tick. Carried across a song
   * change so the previous (still-audible) track's bar keeps advancing until
   * the announced track reaches the speaker.
   */
  private lastElapsedMs: number | null = null;
  /** Audible-clock mark of the previous tick (drives the carry-over delta). */
  private lastAudibleNow = 0;
  /**
   * Whether the UI is foregrounded. Backgrounded, the tick still pushes to
   * the media session (track changes shown on the lock screen) but never
   * writes the React progress store — the hidden tree must not reconcile.
   */
  private uiVisible = true;

  constructor(private readonly options: ProgressTickerOptions) {}

  setUiVisible(value: boolean): void {
    this.uiVisible = value;
  }

  tick(): void {
    const track =
      this.options.getTrack?.() ?? this.options.repository.currentTrack;
    if (!track) return;

    const showProgress = this.options.repository.showProgress;
    if (showProgress !== this.lastShowProgress) {
      // Progress toggled (new track / live) — restart the push cadence
      this.ticks = 0;
      this.lastShowProgress = showProgress;
    }

    const audibleNow = this.options.sync.now();
    const start = track.startTime?.getTime();
    const duration = track.duration ?? 0;
    const { elapsedMs, pending } = getSyncedTrackProgress(track, audibleNow);
    // The track's nominal end passed but the next item is not audible yet
    // (the API's `duration` and the next `startTime` rarely line up to the
    // millisecond). Hold the bar full / countdown at zero for that gap
    // instead of blanking it, so the bar visibly completes.
    const ended =
      showProgress &&
      !pending &&
      elapsedMs == null &&
      duration > 0 &&
      start != null &&
      Number.isFinite(start) &&
      audibleNow >= start + duration;
    // The announced track is still buffered — the previous one is what the
    // speaker is finishing. Carry its bar forward in real time instead of
    // snapping to 0: the package helper collapses "not started" and "ended"
    // to null, and clearing would blank the seek bar after every song change.
    let elapsed = elapsedMs;
    if (pending) {
      if (this.lastElapsedMs != null) {
        const carry = Math.min(
          MAX_BOUNDARY_CARRY_MS,
          Math.max(0, audibleNow - this.lastAudibleNow),
        );
        elapsed = this.lastElapsedMs + carry;
      } else {
        // Cold start mid-change: no previous track to carry.
        elapsed = 0;
      }
      this.lastElapsedMs = elapsed;
    } else if (ended) {
      elapsed = duration;
      this.lastElapsedMs = elapsed;
    } else {
      this.lastElapsedMs = elapsedMs;
    }
    this.lastAudibleNow = audibleNow;
    const prev = progressStore.getSnapshot();

    // Only emit if the value actually changed (avoids 1/sec React re-render)
    if (
      this.uiVisible &&
      (prev.currentTrackProgress !== elapsed ||
        prev.showProgress !== showProgress)
    ) {
      progressStore.setSnapshot({
        currentTrackProgress: elapsed,
        showProgress,
      });
    }

    // Only a track with no usable duration clears the bar; a real ended track
    // is held full above so the bar completes instead of blanking.
    if (showProgress && elapsedMs == null && !pending && !ended) {
      this.endProgress();
      return;
    }

    this.ticks++;
    if (this.ticks < NATIVE_POSITION_PUSH_EVERY_TICKS) return;
    this.ticks = 0;

    const { audio, media } = this.options;
    if (!media.isActive || !audio.hasPlayer) return;

    const metadata = this.options.buildMetadata();
    // Hold the seek bar back until the estimate settles: the position is a
    // wall-clock guess before then, and the OS would interpolate it ahead of
    // the speaker.
    const positionSec =
      showProgress && this.options.sync.settled ? toSec(elapsed) : undefined;

    // No seek bar → the OS interpolates nothing → a push only matters
    // when the metadata or the playback status changed (song change on a
    // live show; status repairs after a lost push, e.g. post-reconnect).
    const key = metadataKey(metadata, this.options.state.remoteStatus);
    if (positionSec === undefined && key === this.lastPushedKey) return;
    this.lastPushedKey = key;

    this.options.media.push(
      metadata,
      this.options.state.remoteStatus,
      positionSec,
    );
  }

  reset(): void {
    this.ticks = 0;
    this.lastPushedKey = null;
    this.lastElapsedMs = null;
    this.lastAudibleNow = 0;
  }

  private endProgress(): void {
    this.options.repository.setShowProgress(false);
    this.ticks = 0;
    if (this.uiVisible) {
      progressStore.setSnapshot({
        currentTrackProgress: null,
        showProgress: false,
      });
    }

    if (!this.options.media.isActive) return;
    const metadata = this.options.buildMetadata();
    this.lastPushedKey = metadataKey(
      metadata,
      this.options.state.remoteStatus,
    );
    this.options.media.push(
      metadata,
      this.options.state.remoteStatus,
      0,
    );
  }
}

/**
 * Identity of a pushed payload — redundant pushes are skipped when
 * nothing changed. The playback status is part of the identity: a
 * status flip alone (playing ↔ buffering after a reconnect) must reach
 * the OS even when the song metadata is identical.
 */
const metadataKey = (
  metadata: NowPlayingMetadata,
  status: RemotePlaybackStatus,
): string =>
  [
    metadata.title,
    metadata.artist,
    metadata.artwork,
    metadata.durationSec ?? "",
    metadata.isLiveStream ? "live" : "",
    status,
  ].join("|");
