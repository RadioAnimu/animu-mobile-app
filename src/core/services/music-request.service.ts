import { MusicRequestPagination } from "../domain/music-request";
import { MusicRequestMapper } from "../../data/mappers/music-request.mapper";
import { animuApiClient as apiClient } from "../../data/http/animu.api";
import {
  MusicRequestSubmissionDTO,
  MusicSearchParamsDto,
} from "../../data/http/dto/music-request.dto";

class MusicRequestService {
  async searchTracksByQuery(
    params: MusicSearchParamsDto,
  ): Promise<MusicRequestPagination> {
    const dto = await apiClient.searchTracks(params);
    return MusicRequestMapper.paginationFromDTO(dto);
  }

  async searchTracksByTitle(title: string): Promise<MusicRequestPagination> {
    const dto = await apiClient.searchTracks(
      MusicRequestMapper.stringTitleToMusicSearchParamsDTO(title),
    );
    return MusicRequestMapper.paginationFromDTO(dto);
  }

  async submitRequest(submissionDTO: MusicRequestSubmissionDTO): Promise<{
    success: boolean;
    detail?: string;
    error?: string;
  }> {
    try {
      const response = await apiClient.submitMusicRequest(submissionDTO);
      return MusicRequestMapper.fromResponseStringToResult(response);
    } catch (error) {
      console.error("Request submission error:", error);
      return {
        success: false,
        error: "REQUEST_ERROR",
      };
    }
  }
}

export const musicRequestService = new MusicRequestService();
