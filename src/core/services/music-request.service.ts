import { MusicRequest, MusicRequestPagination } from "../domain/music-request";
import { MusicRequestMapper } from "../../data/mappers/music-request.mapper";
import { animuApiClient as apiClient } from "../../data/http/animu.api";
import { MusicSearchParamsDto } from "../../data/http/dto/music-search-params.dto";

class MusicRequestService {
  async searchTracksByQuery(
    params: MusicSearchParamsDto
  ): Promise<MusicRequestPagination> {
    const dto = await apiClient.searchTracks(params);
    return MusicRequestMapper.paginationFromDTO(dto);
  }

  async searchTracksByTitle(title: string): Promise<MusicRequestPagination> {
    const dto = await apiClient.searchTracks({
      query: title,
      server: 1,
      filter: "",
      limit: 25,
      offset: 0,
      requestable: true,
    });
    return MusicRequestMapper.paginationFromDTO(dto);
  }
}

export const musicRequestService = new MusicRequestService();
