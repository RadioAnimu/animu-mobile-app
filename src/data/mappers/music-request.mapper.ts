import { API } from "../../api";
import {
  MusicRequest,
  MusicRequestPagination,
} from "../../core/domain/music-request";
import { CONFIG } from "../../utils/player.config";
import {
  MusicRequestDTO,
  MusicRequestResponseDTO,
  MusicSearchParamsDto,
} from "../http/dto/music-request.dto";

const parseTitle = (title: string): [string, string, string] => {
  const [songPart, animePart] = title.split("|").map((s) => s.trim());
  const [artist, song] = songPart.split("-").map((s) => s.trim());
  return [
    song || songPart,
    animePart || "Unknown Anime",
    artist || "Unknown Artist",
  ];
};

export class MusicRequestMapper {
  static resolveArtwork(dto: MusicRequestDTO): string {
    const image = dto.image_large || dto.image_medium || dto.image_tiny;
    return image ? `${API.WEB_URL}${image}` : CONFIG.DEFAULT_COVER;
  }

  static fromDTO(dto: MusicRequestDTO): MusicRequest {
    const [song, anime, artist] = parseTitle(dto.title);
    const artwork = MusicRequestMapper.resolveArtwork(dto);

    return {
      id: dto.id.toString(),
      raw: dto.title,
      song,
      anime,
      artist: dto.author || artist,
      artwork,
      requestable: !dto.timestrike,
    };
  }

  static parseQueryParamsToMusicSearchParamsDTO(
    url: string
  ): MusicSearchParamsDto {
    // Extract query string from URL
    const queryString = url.split("?")[1];

    // If no query string, throw error or return default values
    if (!queryString) {
      throw new Error("No query parameters found in URL");
    }

    // Create URLSearchParams object for easy parsing
    const params = new URLSearchParams(queryString);

    // Parse and convert values to their correct types
    return {
      server: parseInt(params.get("server") || "1", 10),
      filter: params.get("filter") || "",
      query: params.get("query") || "",
      requestable: params.get("requestable") === "true",
      limit: parseInt(params.get("limit") || "25", 10),
      offset: parseInt(params.get("offset") || "0", 10),
    };
  }

  static stringTitleToMusicSearchParamsDTO(
    title: string
  ): MusicSearchParamsDto {
    return {
      server: 1,
      filter: "",
      query: title,
      requestable: true,
      limit: 25,
      offset: 0,
    };
  }

  static paginationFromDTO(
    dto: MusicRequestResponseDTO
  ): MusicRequestPagination {
    return {
      results: dto.objects.map(this.fromDTO),
      nextPageQueryObject: dto.meta.next
        ? MusicRequestMapper.parseQueryParamsToMusicSearchParamsDTO(
            dto.meta.next
          )
        : undefined,
      totalResults: dto.meta.total_count,
      totalPages: Math.ceil(dto.meta.total_count / dto.meta.limit),
    };
  }

  static fromResponseStringToResult(response: string): {
    success: boolean;
    error?: string;
  } {
    if (!response) {
      return { success: true };
    }

    switch (response) {
      case "strike and out":
        return {
          success: false,
          error: "ERROR_STRIKE_AND_OUT",
        };
      default:
        return {
          success: false,
          error: `REQUEST_ERROR${response}`,
        };
    }
  }
}
