import {
  TrackHistoryDTO,
  TrackHistoryItemDTO,
} from "./../http/dto/track-history.dto";
import { Track } from "../../core/domain/track";
import { CONFIG } from "../../utils/player.config";
import { HistoryType } from "../../@types/history-type";

export class TrackHistoryMapper {
  static fromDTO(dto: TrackHistoryDTO, type: HistoryType): Track[] {
    if (!dto || !Array.isArray(dto)) return [];
    return dto
      .filter((item) => item?.[0] && this.isValidHistoryItem(item[0]))
      .map((item) => this.mapHistoryItem(item, type));
  }

  private static isValidHistoryItem(title: string): boolean {
    return title.length > 0 && !title.toLowerCase().includes("animu");
  }

  private static mapHistoryItem(
    item: TrackHistoryItemDTO,
    type: HistoryType,
  ): Track {
    const [raw, title, artist, anime] = this.parseRawTitle(item[0]);
    const isPedidas = type === "requests";
    // Trailing tuple elements are typed loosely (PHP arrays) — coerce here
    const coverUrl = String((isPedidas ? item[3] : item[1]) ?? "");

    return {
      id: isPedidas ? String(item[2] ?? "") || "-1" : "-1",
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
      isRequest: true,
      startTime: this.getStartTime(type, item[1]),
      metadata: {
        artist,
        title: anime,
        artwork: coverUrl || CONFIG.DEFAULT_COVER,
        duration: 0,
      },
    };
  }

  private static parseRawTitle(
    rawTitle: string,
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

  private static getStartTime(type: HistoryType, timeStr: string): Date {
    if (type === "requests" && timeStr) {
      // Build via Date components — Hermes can't parse "Wed Sep 03 2026 HH:MM:SS"
      const [hours = 0, minutes = 0, seconds = 0] = timeStr
        .split(":")
        .map((part) => parseInt(part, 10) || 0);
      const date = new Date();
      date.setHours(hours, minutes, seconds, 0);
      return date;
    }
    return new Date();
  }
}
