import { TrackDTO } from "./dto/track.dto";
import { ProgramDTO } from "./dto/program.dto";
import { API } from "../../api";
import { api } from "./axios.client";
import { Stream } from "../../core/domain/stream";
import { ListenersDTO } from "./dto/listeners.dto";
import { TrackHistoryDTO } from "./dto/track-history.dto";
import { HistoryType } from "../../@types/history-type";
import {
  MusicRequestResponseDTO,
  MusicSearchParamsDto,
  MusicRequestSubmissionDTO,
} from "./dto/music-request.dto";
import { LiveRequestDTO } from "./dto/live-request.dto";
import { convertDTOToFormData } from "../../utils";

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

  async submitMusicRequest(dto: MusicRequestSubmissionDTO): Promise<string> {
    const formData = convertDTOToFormData(dto);

    const response = await api.post(
      API.FAZER_PEDIDO_URL_MOBILE_SUBMIT,
      formData,
      {
        params: {
          ios: dto.ios.toString(),
        },
        transformResponse: [(data) => data], // Prevent axios from parsing the response
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  }

  async submitLiveRequest(request: LiveRequestDTO): Promise<boolean> {
    try {
      const formData = convertDTOToFormData(request);

      const response = await api.post(API.LIVE_REQUEST_URL, formData, {
        transformResponse: [(data) => data], // Prevent axios from parsing the response
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { data } = response;

      return data === "1";
    } catch (error) {
      console.error("Failed to submit live request:", error);
      return false;
    }
  }
}

const animuApiClient = new AnimuApiClient();
export { animuApiClient };
