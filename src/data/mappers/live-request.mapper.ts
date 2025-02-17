import { LiveRequest } from "../../core/domain/live-request";
import { LiveRequestDTO } from "../http/dto/live-request.dto";

export class LiveRequestMapper {
  static toDomain(dto: LiveRequestDTO): LiveRequest {
    return {
      name: dto.name,
      city: dto.city,
      artist: dto.artist,
      music: dto.music,
      anime: dto.anime,
      request: dto.request,
    };
  }

  static toDTO(domain: LiveRequest): LiveRequestDTO {
    return {
      name: domain.name,
      city: domain.city,
      artist: domain.artist,
      music: domain.music,
      anime: domain.anime,
      request: domain.request,
    };
  }
}
