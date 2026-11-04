import {
  type AnimuApi,
  type AnimuLive,
  type ArtworkQuality,
  type HistoryType,
  type Listeners,
  type LiveNowPlaying,
  type Track,
} from "animu-api";
import type { Program } from "@/core/domain/program";
import {
  abortPlayerRequests,
  createApiClient,
  playerRequestSignal,
} from "@/api/client";
import { userSettingsService } from "@/core/services/user-settings.service";

class AnimuService {
  /** Lazily-created SSE surface, keyed by `quality|cover` (constructor state). */
  private liveClient: AnimuLive | null = null;
  private liveKey = "";
  /**
   * Program client, rebuilt only when the artwork quality changes, so the
   * package's GET micro-cache survives between polls.
   */
  private programClient: AnimuApi | null = null;
  private programClientQuality: ArtworkQuality | null = null;
  /**
   * Track + listeners in one snapshot: the SSE daemon's seeded `song_change`,
   * read and closed. A client per call carries the runtime quality and cover.
   */
  async getStreamMetadata(
    artworkQuality?: ArtworkQuality,
    defaultCover?: string,
  ): Promise<{ track: Track | null; listeners: Listeners }> {
    const client = createApiClient(artworkQuality ?? "medium", defaultCover, {
      playerScoped: true,
    });
    // The scope's signal, not just the scoped fetch: the watchdog must also
    // reach the wait for the first SSE event, after the headers arrived.
    return client.getStreamMetadata({ signal: playerRequestSignal() });
  }

  /** Fetches the program currently on air. */
  async getCurrentProgram(): Promise<Program> {
    return this.getProgramClient().getProgram();
  }

  private getProgramClient(): AnimuApi {
    const quality = userSettingsService.getCurrentSettings().liveQualityCover;
    if (this.programClientQuality !== quality || !this.programClient) {
      this.programClientQuality = quality;
      this.programClient = createApiClient(quality, undefined, {
        playerScoped: true,
      });
    }
    return this.programClient;
  }

  /** A history feed (played/requested), with the runtime quality and cover. */
  async getTrackHistory(
    type: HistoryType,
    artworkQuality?: ArtworkQuality,
    defaultCover?: string,
  ): Promise<Track[]> {
    const client = createApiClient(artworkQuality ?? "medium", defaultCover, {
      playerScoped: true,
    });
    return client.getTrackHistory(type);
  }

  /**
   * Watchdog hook: aborts the player's own data requests when a refresh
   * outlives its limit (in the background the JS-timer abort never fires).
   * Scoped, see {@link abortPlayerRequests}; the SSE stream is not affected.
   */
  abortInFlightRequests(): void {
    abortPlayerRequests();
  }

  /**
   * Realtime now-playing via the SSE daemon. A changed quality/cover key
   * rebuilds the client; the daemon seeds each connection, so that is
   * seamless. Not `playerScoped`: the watchdog must not cut the stream.
   */
  subscribeLive(
    quality: ArtworkQuality,
    defaultCover: string,
    handlers: {
      onSongChange: (song: LiveNowPlaying) => void;
      onListeners: (listeners: Listeners) => void;
      onOpen?: () => void;
      onError?: (error: Error) => void;
    },
  ): () => void {
    const key = `${quality}|${defaultCover}`;
    if (this.liveKey !== key || !this.liveClient) {
      this.liveKey = key;
      this.liveClient = createApiClient(quality, defaultCover).live;
    }
    const client = this.liveClient;
    const subscription = client.subscribe({
      ...(handlers.onOpen ? { onOpen: handlers.onOpen } : {}),
      onSongChange: (song) => handlers.onSongChange(song),
      onListeners: (listeners) => handlers.onListeners(listeners),
      ...(handlers.onError ? { onError: handlers.onError } : {}),
    });
    return () => {
      if (this.liveClient !== client) return;
      subscription.close();
      // Session stops with no subscribers; drop the handle so a later
      // quality-keyed subscribe() rebuilds from a clean state.
      this.liveClient = null;
      this.liveKey = "";
    };
  }

  /**
   * Fires the live client's overdue reconnect / idle timeout. They run on JS
   * timers, frozen on Android in the background; the player's native
   * progress events drive this so a dropped stream comes back there too.
   */
  tickLive(): void {
    this.liveClient?.tick();
  }
}

export const animuService = new AnimuService();
