import { ArtworkQuality } from "../../@types/artwork-quality";
import { HistoryType } from "../../@types/history-type";
import { animuApiClient as apiClient } from "../../data/http/animu.api";
import { ListenersMapper } from "../../data/mappers/listeners.mapper";
import { ProgramMapper } from "../../data/mappers/program.mapper";
import { TrackHistoryMapper } from "../../data/mappers/track-history.mapper";
import { TrackMapper } from "../../data/mappers/track.mapper";
import { Listeners } from "../domain/listeners";
import { Program } from "../domain/program";
import { Track } from "../domain/track";

class AnimuService {
  /**
   * Fetches track + listeners from a single API call (BASE_URL).
   */
  async getStreamMetadata(
    artworkQuality?: ArtworkQuality,
  ): Promise<{ track: Track | null; listeners: Listeners }> {
    const dto = await apiClient.getStreamMetadata();
    return {
      track: TrackMapper.fromDTO(dto, artworkQuality),
      listeners: ListenersMapper.fromDTO(dto),
    };
  }

  async getCurrentProgram(): Promise<Program> {
    const dto = await apiClient.getProgramInfo();
    const program = ProgramMapper.fromDTO(dto);

    return program;
  }

  async getTrackHistory(type: HistoryType): Promise<Track[]> {
    const dto = await apiClient.getTrackHistory(type);
    return TrackHistoryMapper.fromDTO(dto, type);
  }
}

export const animuService = new AnimuService();
