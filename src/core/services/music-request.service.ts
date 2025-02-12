// import { ArtworkQuality } from "../../@types/artwork-quality";
// import { animuApiClient } from "../../data/http/animu.api";
// import { MusicRequestMapper } from "../../data/mappers/music-request.mapper";
// import { MusicRequest, PaginatedResponse } from "../domain/music-request";

// class MusicRequestService {
//   async searchMusic(
//     query: string,
//     artworkQuality?: ArtworkQuality
//   ): Promise<PaginatedResponse<MusicRequest>> {
//     const response = await animuApiClient.searchMusicRequest(query);
//     return MusicRequestMapper.fromDTOList(response, artworkQuality);
//   }

//   async loadMore(
//     url: string,
//     artworkQuality?: ArtworkQuality
//   ): Promise<PaginatedResponse<MusicRequest>> {
//     const response = await animuApiClient.loadMoreMusicRequests(url);
//     return MusicRequestMapper.fromDTOList(response, artworkQuality);
//   }

//   async submitRequest(
//     musicId: number,
//     message: string,
//     sessionId: string
//   ): Promise<{ success: boolean; error?: string }> {
//     try {
//       const response = await animuApiClient.submitMusicRequest(
//         musicId,
//         message,
//         sessionId
//       );

//       if (response.error) {
//         return { success: false, error: response.error };
//       }

//       return { success: true };
//     } catch (error) {
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : "Unknown error",
//       };
//     }
//   }
// }

// export const musicRequestService = new MusicRequestService();
