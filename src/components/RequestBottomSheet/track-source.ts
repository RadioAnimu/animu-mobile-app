import type { MusicRequest } from "@/core/domain/music-request";

/**
 * The chip under the song: its anime, or for a song from none (a J-Pop
 * single) the release it comes from — unless that's just the song's name
 * again — then its genre. Nothing at all hides the chip.
 */
export function trackSource(track: MusicRequest): string {
  if (track.anime) return track.anime;
  const sameAsSong = track.album.toLocaleLowerCase() === track.song.toLocaleLowerCase();
  if (track.album && !sameAsSong) return track.album;
  return track.genre;
}
