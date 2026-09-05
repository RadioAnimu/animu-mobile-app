import { getTrackProgress } from "../domain/track";
import type { NowPlayingMetadata } from "react-native-playback-controls";
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
 * 1 Hz heartbeat. Driven by TWO sources that the orchestrator gates into
 * at-most-one tick per second (see `PlayerService.tickProgress`):
 *
 * - native `playbackStatusUpdate` events while PLAYING — these keep
 *   firing in the background (foreground service on Android, background
 *   audio on iOS), so the media session stays fresh where JS timers
 *   freeze/throttle;
 * - the JS "track-progress" task — covers paused-in-foreground, where
 *   native events go silent but the radio keeps playing server-side.
 *
 * Per tick:
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
    // when the metadata itself changed (song change on a live show).
    const key = metadataKey(metadata);
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
    this.lastPushedKey = metadataKey(metadata);
    this.options.publisher.push(
      metadata,
      this.options.state.remoteStatus,
      0,
    );
  }
}

/** Identity of a metadata payload — pushes are skipped when unchanged. */
const metadataKey = (metadata: NowPlayingMetadata): string =>
  [
    metadata.title,
    metadata.artist,
    metadata.album,
    metadata.artwork,
    metadata.durationSec ?? "",
    metadata.isLiveStream ? "live" : "",
  ].join("|");
