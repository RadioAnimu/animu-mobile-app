import { TrackDTO } from "./dto/track.dto";
import { ProgramDTO } from "./dto/program.dto";
import { API } from "../../api";
import { api } from "./axios.client";
import { Stream } from "../../core/domain/stream";
import { ListenersDTO } from "./dto/listeners.dto";
import { TrackHistoryDTO } from "./dto/track-history.dto";

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
  getTrackHistory = async (
    type: "pedidas" | "tocadas"
  ): Promise<TrackHistoryDTO> => {
    const url =
      type === "pedidas" ? API.ULTIMAS_PEDIDAS_URL : API.ULTIMAS_TOCADAS_URL;
    const response = await api.get<TrackHistoryDTO>(url);
    return response.data;
  };
}

const animuApiClient = new AnimuApiClient();
export { animuApiClient };
