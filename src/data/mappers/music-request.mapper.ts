import { API } from "../../api";
import {
  MusicRequest,
  MusicRequestPagination,
} from "../../core/domain/music-request";
import { DICT, LanguageKey } from "../../languages";
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
    url: string,
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
    title: string,
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
    dto: MusicRequestResponseDTO,
  ): MusicRequestPagination {
    return {
      results: dto.objects.map(this.fromDTO),
      nextPageQueryObject: dto.meta.next
        ? MusicRequestMapper.parseQueryParamsToMusicSearchParamsDTO(
            dto.meta.next,
          )
        : undefined,
      totalResults: dto.meta.total_count,
      totalPages: Math.ceil(dto.meta.total_count / dto.meta.limit),
    };
  }

  static fromResponseStringToResult(response: string): {
    success: boolean;
    error?: string;
    detail?: string;
  } {
    if (response === "") return { success: true };

    try {
      const parsed = JSON.parse(response);

      if (parsed.erro === "false" || parsed.erro === false) {
        return { success: false, error: "PANEL_UNAVAILABLE" };
      }

      // other structured errors from PHP: pediblock, aniblock, artistblock, coverblock, harublock
      const knownBlocks = [
        "pediblock",
        "aniblock",
        "artistblock",
        "coverblock",
      ];
      for (const block of knownBlocks) {
        if (parsed[block]) {
          return {
            success: false,
            error: block.toUpperCase(),
            detail: parsed[block],
          };
        }
      }

      return {
        success: false,
        error: typeof parsed.erro === "string" ? parsed.erro : "REQUEST_ERROR",
      };
    } catch {
      return { success: false, error: response };
    }
  }

  static getErrorMessage(
    error?: string,
    detail?: string,
    lang: LanguageKey = "PT",
  ): string {
    switch (error) {
      case "PEDIBLOCK":
        return detail
          ? `This track was already requested. Available again after ${new Date(detail + "Z").toLocaleTimeString()}`
          : "This track was requested too recently.";
      case "ANIBLOCK":
        return `Too many songs from "${detail}" in the last 90 minutes.`;
      case "ARTISTBLOCK":
        return `Too many songs from "${detail}" in the last 90 minutes.`;
      case "harublock":
        return "This track was played too recently by the AutoDJ.";
      case "strike and out":
        return "You've reached the request limit.";
      case "ONAIR":
        return "Requests are disabled while a DJ is live.";
      case "BLOCOBLOCK":
        return "Requests are currently disabled.";
      case "NOLOGIN":
        return "Your session expired. Please log in again.";
      case "NO2FA":
        return "You need 2FA enabled on Discord to make requests.";
      case "PANEL_UNAVAILABLE":
        return "The radio panel is temporarily unavailable. Try again in a moment.";
      default:
        return DICT[lang].REQUEST_ERROR;
    }
  }
}
