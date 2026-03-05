import { ProgramDTO } from "./dto/program.dto";
import { API } from "../../api";
import { api } from "./axios.client";
import { StreamMetadataDTO } from "./dto/stream-metadata.dto";
import { TrackHistoryDTO } from "./dto/track-history.dto";
import { HistoryType } from "../../@types/history-type";
import {
  MusicRequestResponseDTO,
  MusicSearchParamsDto,
  MusicRequestSubmissionDTO,
} from "./dto/music-request.dto";
import { LiveRequestDTO } from "./dto/live-request.dto";
import { convertDTOToFormData, logFormData } from "../../utils";

class AnimuApiClient {
  /**
   * Single call to BASE_URL — returns track info + listener count.
   */
  getStreamMetadata = async (): Promise<StreamMetadataDTO> => {
    const response = await api.get<StreamMetadataDTO>(API.BASE_URL);
    return response.data;
  };

  getProgramInfo = async (): Promise<ProgramDTO> => {
    const response = await api.get<ProgramDTO>(API.PROGRAM_URL);
    return response.data;
  };

  getTrackHistory = async (type: HistoryType): Promise<TrackHistoryDTO> => {
    const url =
      type === "requests" ? API.ULTIMAS_PEDIDAS_URL : API.ULTIMAS_TOCADAS_URL;
    const response = await api.get<TrackHistoryDTO>(url);
    return response.data;
  };

  async searchTracks(
    params: MusicSearchParamsDto,
  ): Promise<MusicRequestResponseDTO> {
    const response = await api.get<MusicRequestResponseDTO>(
      API.FAZER_PEDIDO_URL,
      {
        params,
      },
    );
    return response.data;
  }
  async submitMusicRequest(dto: MusicRequestSubmissionDTO): Promise<string> {
    const formData = convertDTOToFormData(dto);
    logFormData("submitMusicRequest", formData);

    const response = await api.post(API.FAZER_PEDIDO_URL_SUBMIT, formData, {
      params: { mobileapp: "1" },
      responseType: "text",
    });

    return response.data;
  }

  async submitLiveRequest(request: LiveRequestDTO): Promise<boolean> {
    try {
      const formData = convertDTOToFormData(request);

      const response = await api.post(API.LIVE_REQUEST_URL, formData, {
        responseType: "text",
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
