import { ArtworkQuality } from "../../@types/artwork-quality";
import { Track, updateTrackProgress } from "../../core/domain/track";
import { isUrlAnImage } from "../../utils";
import { CONFIG } from "../../utils/player.config";
import { TrackDTO } from "../http/dto/track.dto";

class TrackMapper {
  static fromDTO(
    dto: TrackDTO,
    artworkQuality: ArtworkQuality = "medium"
  ): Track {
    const [raw, title, artist, anime] = this.parseRawTitle(dto.rawtitle);

    return updateTrackProgress({
      id: dto.track.playlist.track_id.toString(),
      raw,
      anime,
      title: title,
      artist: artist || dto.track.artist,
      artworks: dto.track.artworks,
      artwork: this.selectArtwork(dto.track.artworks, artworkQuality),
      duration: dto.track.duration,
      startTime: new Date(dto.track.timestart),
      progress: 0,
      isRequest: dto.rawtitle.toLowerCase().includes("pedido"),
      metadata: {
        artist: dto.track.artist,
        title: anime,
        artwork: this.selectArtwork(dto.track.artworks, artworkQuality),
      },
    });
  }

  private static parseRawTitle(
    rawTitle: string
  ): [string, string, string, string] {
    // Initialize defaults
    const raw = rawTitle;
    let title = rawTitle;
    let artist = "";
    let anime = "Tocando Agora";

    // Split by pipe first to separate anime
    const [mainPart, animePart] = rawTitle.split(" | ");
    if (animePart) {
      anime = animePart.trim();
    }

    // Split main part by dash to get artist and title
    if (mainPart) {
      const [artistPart, titlePart] = mainPart.split(" - ");
      if (titlePart) {
        title = titlePart.trim();
        artist = artistPart.trim();
      } else {
        // If no dash, whole mainPart is the title
        title = mainPart.trim();
      }
    }

    return [raw, title, artist, anime];
  }

  private static selectArtwork(
    artworks: TrackDTO["track"]["artworks"],
    quality: ArtworkQuality
  ): string {
    let res: string;
    switch (quality) {
      case "high":
        res =
          artworks.large ||
          artworks.medium ||
          artworks.tiny ||
          CONFIG.DEFAULT_COVER;
        break;
      case "medium":
        res = artworks.medium || artworks.tiny || CONFIG.DEFAULT_COVER;
        break;
      case "low":
        res = artworks.tiny || CONFIG.DEFAULT_COVER;
        break;
      default:
        res = CONFIG.DEFAULT_COVER;
        break;
    }
    return isUrlAnImage(res) ? res : CONFIG.DEFAULT_COVER;
  }
}

export { TrackMapper };
