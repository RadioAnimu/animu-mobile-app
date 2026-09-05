import type { ArtworkQuality, HistoryType, Track, Listeners } from "animu-api";
import { abortAllInFlightRequests } from "animu-api";
import type { Program } from "../domain/program";
import { DICT } from "../../i18n";
import type { Program as ProgramDictionaryEntry } from "../../api";
import { animuApi, createMetadataClient } from "../../api/client";

class AnimuService {
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
    const client = createMetadataClient(artworkQuality ?? "medium", defaultCover);
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
    const client = createMetadataClient(artworkQuality ?? "medium", defaultCover);
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
