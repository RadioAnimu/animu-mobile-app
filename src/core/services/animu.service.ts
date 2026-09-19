import {
  abortAllInFlightRequests,
  type AnimuLive,
  type ArtworkQuality,
  type HistoryType,
  type Listeners,
  type LiveNowPlaying,
  type Track,
} from "animu-api";
import type { Program } from "@/core/domain/program";
import { DICT } from "@/i18n";
import type { Program as ProgramDictionaryEntry } from "@/api";
import { animuApi, createApiClient } from "@/api/client";

class AnimuService {
  /** Lazily-created SSE surface, keyed by `quality|cover` (constructor state). */
  private liveClient: AnimuLive | null = null;
  private liveKey = "";
  /**
   * Fetches track + listeners from a single API call.
   *
   * Artwork quality is a runtime user setting and the default cover a
   * runtime resolver value (bundled asset), so this uses a dedicated
   * client per call instead of the shared one.
   */
  async getStreamMetadata(
    artworkQuality?: ArtworkQuality,
    defaultCover?: string,
  ): Promise<{ track: Track | null; listeners: Listeners }> {
    const client = createApiClient(artworkQuality ?? "medium", defaultCover);
    return client.getStreamMetadata();
  }

  /**
   * Fetches the program currently on air, enriched with the matching i18n
   * dictionary entry (the package doesn't know about DICT).
   */
  async getCurrentProgram(): Promise<Program> {
    const program = await animuApi.getProgram();
    return {
      ...program,
      raw: findRawProgram(program.name),
    };
  }

  /**
   * Fetches a history feed (played/requested).
   *
   * Same rationale as getStreamMetadata: the user's artwork quality and
   * the resolver's default cover are runtime values — history covers are
   * size-variant picks, so the shared client's module-load defaults would
   * pin every row to medium quality.
   */
  async getTrackHistory(
    type: HistoryType,
    artworkQuality?: ArtworkQuality,
    defaultCover?: string,
  ): Promise<Track[]> {
    const client = createApiClient(artworkQuality ?? "medium", defaultCover);
    return client.getTrackHistory(type);
  }

  /**
   * Watchdog hook — aborts every in-flight request (shared + per-call
   * clients). Called by the player's native-driven heartbeat when a data
   * refresh outlives its hard limit: in the background, the JS-timer
   * abort inside HttpClient never fires, so stalled requests would hang
   * forever and freeze the now-playing data.
   */
  abortInFlightRequests(): void {
    abortAllInFlightRequests();
  }

  /**
   * Realtime now-playing (`song_change` + `listeners`) via the station's
   * SSE daemon. Quality/cover are captured per client (constructor state),
   * so a changed key rebuilds the surface — the daemon seeds every new
   * connection with the current state, making the rebuild seamless.
   *
   * The SSE connection is deliberately NOT covered by
   * {@link abortAllInFlightRequests}: its AbortController lives inside
   * `AnimuLive` and must survive the watchdog, which exists to cut stale
   * one-shot fetches only.
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
}

const findRawProgram = (
  programName: string,
): ProgramDictionaryEntry | undefined => {
  if (!programName) return undefined;

  const programNameLower = programName.trim().toLowerCase();
  return DICT["PT"].PROGRAMS.find(
    (program) => program.name.trim().toLowerCase() === programNameLower,
  );
};

export const animuService = new AnimuService();
