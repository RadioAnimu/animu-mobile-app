import { Listeners } from "../../core/domain/listeners";
import { ListenersDTO } from "../http/dto/listeners.dto";

export class ListenersMapper {
  static fromDTO(dto: ListenersDTO): Listeners {
    return {
      value: (dto.listeners ??
        dto.currentListeners ??
        dto.active_listeners ??
        dto.total ??
        0) as number,
    };
  }
}
