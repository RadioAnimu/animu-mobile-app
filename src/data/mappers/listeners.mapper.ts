import { Listeners } from "../../core/domain/listeners";
import { ListenersDTO } from "../http/dto/listeners.dto";

export class ListenersMapper {
  static fromDTO(dto: ListenersDTO): Listeners {
    // Field name varies by endpoint — first known alias wins
    const value =
      dto.listeners ??
      dto.currentListeners ??
      dto.active_listeners ??
      dto.total ??
      0;
    return { value: Number.isFinite(value) && value >= 0 ? value : 0 };
  }
}
