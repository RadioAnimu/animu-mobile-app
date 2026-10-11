import { useEffect, useSyncExternalStore } from "react";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { LyricsService, lyricsService, lyricsStore, type LyricsSnapshot } from "@/core/lyrics";

/**
 * Lyrics of the song being heard, while the caller is mounted: the service
 * follows the heard track (and warms the next announced one) only while
 * someone is looking.
 */
export function useLyrics(): LyricsSnapshot & { retry: () => void } {
  const { currentTrack } = usePlayer();
  const snapshot = useSyncExternalStore(lyricsStore.subscribe, lyricsStore.getSnapshot);
  const service = lyricsService();
  // The track object is re-emitted per cover/state change: follow its identity.
  const key = LyricsService.isSong(currentTrack) ? LyricsService.keyOf(currentTrack) : null;

  useEffect(() => {
    service.show(currentTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the song, not the object.
  }, [service, key]);

  useEffect(() => () => service.hide(), [service]);

  // A snapshot of the previous song (or a lookup still landing) is not shown.
  const current: LyricsSnapshot =
    snapshot.trackKey === key
      ? snapshot
      : { status: key ? "loading" : "idle", trackKey: key, lyrics: null };
  return { ...current, retry: () => service.retry() };
}
