import { getTrackProgress } from "../domain/track";
import type {
  NowPlayingMetadata,
  PlaybackStatus,
} from "react-native-playback-controls";
import { progressStore } from "./store";
import type { MediaSessionPublisher } from "./media-session.publisher";
import type { NowPlayingRepository } from "./now-playing.repository";
import type { AudioTransport } from "./transport";
import type { TransportStateMachine } from "./transport-state";

/** ms → seconds for the native media session, rejecting NaN/Infinity */
export const toSec = (ms: number | null | undefined): number | undefined =>
  ms != null && Number.isFinite(ms) ? ms / 1000 : undefined;

/** Push to the native session every N ticks. */
const NATIVE_POSITION_PUSH_EVERY_TICKS = 3;

export interface ProgressTickerOptions {
  repository: NowPlayingRepository;
  state: TransportStateMachine;
  transport: AudioTransport;
  publisher: MediaSessionPublisher;
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
 * - Detects track end (`getTrackProgress` → null while progress is shown)
 *   and clears the progress UI + native seek bar.
 * - Every Nth tick pushes metadata + status to the media session. With a
 *   seek bar (non-live) the position rides along so the OS can
 *   interpolate it; on LIVE streams there is no bar, so redundant pushes
 *   are skipped unless the metadata itself changed.
 */
export class ProgressTicker {
  private ticks = 0;
  private lastShowProgress = false;
  private lastPushedKey: string | null = null;

  constructor(private readonly options: ProgressTickerOptions) {}

  tick(): void {
    const track = this.options.repository.currentTrack;
    if (!track) return;

    const showProgress = this.options.repository.showProgress;
    if (showProgress !== this.lastShowProgress) {
      // Progress toggled (new track / live) — restart the push cadence
      this.ticks = 0;
      this.lastShowProgress = showProgress;
    }

    const elapsed = getTrackProgress(track);
    const prev = progressStore.getSnapshot();

    // Only emit if the value actually changed (avoids 1/sec React re-render)
    if (
      prev.currentTrackProgress !== elapsed ||
      prev.showProgress !== showProgress
    ) {
      progressStore.setSnapshot({
        currentTrackProgress: elapsed,
        showProgress,
      });
    }

    // Track end only applies to real, non-live tracks (live metadata has
    // no reliable duration, and the radio keeps playing server-side).
    if (showProgress && elapsed == null) {
      this.endProgress();
      return;
    }

    this.ticks++;
    if (this.ticks < NATIVE_POSITION_PUSH_EVERY_TICKS) return;
    this.ticks = 0;

    const { transport } = this.options;
    if (!transport.isSessionReady || !transport.hasPlayer) return;

    const metadata = this.options.buildMetadata();
    const positionSec = showProgress ? toSec(elapsed) : undefined;

    // No seek bar → the OS interpolates nothing → a push only matters
    // when the metadata or the playback status changed (song change on a
    // live show; status repairs after a lost push, e.g. post-reconnect).
    const key = metadataKey(metadata, this.options.state.remoteStatus);
    if (positionSec === undefined && key === this.lastPushedKey) return;
    this.lastPushedKey = key;

    this.options.publisher.push(
      metadata,
      this.options.state.remoteStatus,
      positionSec,
    );
  }

  reset(): void {
    this.ticks = 0;
    this.lastPushedKey = null;
  }

  private endProgress(): void {
    this.options.repository.setShowProgress(false);
    this.ticks = 0;
    progressStore.setSnapshot({
      currentTrackProgress: null,
      showProgress: false,
    });

    if (!this.options.transport.isSessionReady) return;
    const metadata = this.options.buildMetadata();
    this.lastPushedKey = metadataKey(
      metadata,
      this.options.state.remoteStatus,
    );
    this.options.publisher.push(
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
  status: PlaybackStatus,
): string =>
  [
    metadata.title,
    metadata.artist,
    metadata.album,
    metadata.artwork,
    metadata.durationSec ?? "",
    metadata.isLiveStream ? "live" : "",
    status,
  ].join("|");
