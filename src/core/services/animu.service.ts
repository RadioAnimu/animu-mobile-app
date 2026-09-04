import type { ArtworkQuality, HistoryType, Track, Listeners } from "animu-api";
import type { Program } from "../domain/program";
import { DICT } from "../../i18n";
import type { Program as ProgramDictionaryEntry } from "../../api";
import { animuApi, createMetadataClient } from "../../api/client";

class AnimuService {
  /**
   * Fetches track + listeners from a single API call.
   *
   * Artwork quality is a runtime user setting, so this uses a dedicated
   * client per call instead of the shared one.
   */
  async getStreamMetadata(
    artworkQuality?: ArtworkQuality,
  ): Promise<{ track: Track | null; listeners: Listeners }> {
    const client = createMetadataClient(artworkQuality ?? "medium");
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

  async getTrackHistory(type: HistoryType): Promise<Track[]> {
    return animuApi.getTrackHistory(type);
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
