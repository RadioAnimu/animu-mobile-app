import { Listeners } from "../../core/domain/listeners";
import { ListenersDTO } from "../http/dto/listeners.dto";

export class ListenersMapper {
  static fromDTO(dto: ListenersDTO): Listeners {
    // Coerce — guard against numeric-strings from the API
    const value = Number(
      dto.listeners ??
        dto.currentListeners ??
        dto.active_listeners ??
        dto.total ??
        0,
    );
    return { value: Number.isFinite(value) && value >= 0 ? value : 0 };
  }
}
