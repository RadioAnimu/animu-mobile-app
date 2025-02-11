import {
  TrackHistoryDTO,
  TrackHistoryItemDTO,
} from "./../http/dto/track-history.dto";
import { Track } from "../../core/domain/track";
import { CONFIG } from "../../utils/player.config";

export class TrackHistoryMapper {
  static fromDTO(dto: TrackHistoryDTO, type: "pedidas" | "tocadas"): Track[] {
    return dto
      .filter((item) => this.isValidHistoryItem(item[0]))
      .map((item) => this.mapHistoryItem(item, type));
  }

  private static isValidHistoryItem(title: string): boolean {
    return title.length > 0 && !title.toLowerCase().includes("animu");
  }

  private static mapHistoryItem(
    item: TrackHistoryItemDTO,
    type: "pedidas" | "tocadas"
  ): Track {
    const [raw, title, artist, anime] = this.parseRawTitle(item[0]);
    const isPedidas = type === "pedidas";
    const coverUrl = isPedidas ? item[3] : item[1];

    return {
      id: isPedidas ? item[2]?.toString() || "-1" : "-1",
      raw,
      title,
      artist,
      anime,
      artworks: {
        tiny: coverUrl,
        medium: coverUrl,
        large: coverUrl,
      },
      artwork: coverUrl || CONFIG.DEFAULT_COVER,
      duration: 0,
      progress: 0,
      isRequest: true,
      startTime: this.getStartTime(type, item[1]),
      metadata: {
        artist,
        title: anime,
        artwork: coverUrl || CONFIG.DEFAULT_COVER,
      },
    };
  }

  private static parseRawTitle(
    rawTitle: string
  ): [string, string, string, string] {
    const raw = rawTitle;
    const [songPart, anime = "Tocando Agora"] = rawTitle
      .split(" | ")
      .map((s) => s.trim());
    const [artist = "", title = songPart] = songPart
      .split(" - ")
      .map((s) => s.trim());

    return [raw, title, artist, anime];
  }

  private static getStartTime(
    type: "pedidas" | "tocadas",
    timeStr: string
  ): Date {
    if (type === "pedidas") {
      return new Date(new Date().toDateString() + " " + timeStr + ":00");
    }
    return new Date();
  }
}
