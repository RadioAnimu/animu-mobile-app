import { TrackDTO } from "./dto/track.dto";
import { ProgramDTO } from "./dto/program.dto";
import { API } from "../../api";
import { api } from "./axios.client";
import { Stream } from "../../core/domain/stream";
import { ListenersDTO } from "./dto/listeners.dto";
import { TrackHistoryDTO } from "./dto/track-history.dto";
import { HistoryType } from "../../@types/history-type";
import { MusicRequestResponseDTO } from "./dto/music-request.dto";
import { MusicSearchParamsDto } from "./dto/music-search-params.dto";

class AnimuApiClient {
  getCurrentTrack = async (stream: Stream): Promise<TrackDTO> => {
    const response = await api.get<TrackDTO>(
      stream.category === "REPRISES" ? API.SAIJIKKOU_URL : API.BASE_URL
    );
    return response.data;
  };
  getProgramInfo = async (stream: Stream): Promise<ProgramDTO> => {
    const response = await api.get<ProgramDTO>(
      stream.category === "REPRISES" ? API.SAIJIKKOU_URL : API.PROGRAM_URL
    );
    return response.data;
  };
  getListeners = async (stream: Stream): Promise<ListenersDTO> => {
    const response = await api.get<ListenersDTO>(
      stream.category === "REPRISES" ? API.SAIJIKKOU_URL : API.BASE_URL
    );
    return response.data;
  };
  getTrackHistory = async (type: HistoryType): Promise<TrackHistoryDTO> => {
    const url =
      type === "requests" ? API.ULTIMAS_PEDIDAS_URL : API.ULTIMAS_TOCADAS_URL;
    const response = await api.get<TrackHistoryDTO>(url);
    return response.data;
  };
  async searchTracks(
    params: MusicSearchParamsDto
  ): Promise<MusicRequestResponseDTO> {
    const response = await api.get<MusicRequestResponseDTO>(
      API.FAZER_PEDIDO_URL,
      {
        params,
      }
    );

    return response.data;
  }
}

const animuApiClient = new AnimuApiClient();
export { animuApiClient };
