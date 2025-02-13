import { ArtworkQuality } from "../../@types/artwork-quality";
import { HistoryType } from "../../@types/history-type";
import { animuApiClient as apiClient } from "../../data/http/animu.api";
import { ListenersMapper } from "../../data/mappers/listeners.mapper";
import { ProgramMapper } from "../../data/mappers/program.mapper";
import { TrackHistoryMapper } from "../../data/mappers/track-history.mapper";
import { TrackMapper } from "../../data/mappers/track.mapper";
import { Listeners } from "../domain/listeners";
import { Program } from "../domain/program";
import { Stream } from "../domain/stream";
import { Track } from "../domain/track";

class AnimuService {
  async getCurrentTrack(
    stream: Stream,
    artworkQuality?: ArtworkQuality
  ): Promise<Track> {
    const dto = await apiClient.getCurrentTrack(stream);
    return TrackMapper.fromDTO(dto, artworkQuality);
  }

  async getCurrentProgram(stream: Stream): Promise<Program> {
    const dto = await apiClient.getProgramInfo(stream);
    return ProgramMapper.fromDTO(dto, stream.category === "REPRISES");
  }

  async getCurrentListeners(stream: Stream): Promise<Listeners> {
    const dto = await apiClient.getListeners(stream);
    return ListenersMapper.fromDTO(dto);
  }

  async getTrackHistory(type: HistoryType): Promise<Track[]> {
    const dto = await apiClient.getTrackHistory(type);
    return TrackHistoryMapper.fromDTO(dto, type);
  }
}

export const animuService = new AnimuService();
