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

/** Push the elapsed position to the native session every N ticks. */
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
 * 1 Hz heartbeat, driven by the app-level poll task ("track-progress" in
 * `background.service.ts` — see `PlayerProvider` for the visibility gates).
 *
 * - Updates `progressStore` only when the value actually changed (avoids
 *   1/sec React re-renders).
 * - Detects track end (`getTrackProgress` → null while progress is shown)
 *   and clears the progress UI + native seek bar.
 * - Periodically pushes the elapsed position to the media session — the
 *   OS interpolates the seek bar between snapshots.
 */
export class ProgressTicker {
  private ticks = 0;
  private lastShowProgress = false;

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

    if (!showProgress) return;

    if (elapsed == null) {
      this.endProgress();
      return;
    }

    this.ticks++;
    if (this.ticks < NATIVE_POSITION_PUSH_EVERY_TICKS) return;
    this.ticks = 0;

    const { transport } = this.options;
    if (transport.isSessionReady && transport.hasPlayer) {
      this.options.publisher.push(
        this.options.buildMetadata(),
        this.options.state.remoteStatus,
        toSec(elapsed),
      );
    }
  }

  reset(): void {
    this.ticks = 0;
  }

  private endProgress(): void {
    this.options.repository.setShowProgress(false);
    this.ticks = 0;
    progressStore.setSnapshot({
      currentTrackProgress: null,
      showProgress: false,
    });

    if (!this.options.transport.isSessionReady) return;
    this.options.publisher.push(
      this.options.buildMetadata(),
      this.options.state.remoteStatus,
      0,
    );
  }
}
