import { useEffect, useState } from "react";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { LyricsService, lyricsService } from "@/core/lyrics";

/**
 * Whether the heard song has lyrics to show:
 * - `checking` while it is being looked up;
 * - `available` (synced or untimed);
 * - `missing`: none, an instrumental, or not a song (a jingle);
 * - `unknown` when the lookup failed (the lyrics can still be opened and
 *   retried there).
 * Looks a song up once, when it starts being heard, and never in the
 * background.
 */
export type LyricsAvailability = "checking" | "available" | "missing" | "unknown";

export function useLyricsAvailability(): LyricsAvailability {
  const { currentTrack } = usePlayer();
  const isBackgrounded = useIsBackgrounded();
  const key = LyricsService.isSong(currentTrack) ? LyricsService.keyOf(currentTrack) : null;
  const [result, setResult] = useState<{ key: string; availability: LyricsAvailability } | null>(null);

  useEffect(() => {
    if (!key || isBackgrounded) return undefined;
    let cancelled = false;
    lyricsService()
      .lyricsFor(currentTrack)
      .then((lyrics) => {
        const available = lyrics != null && lyrics.kind !== "instrumental";
        if (!cancelled) setResult({ key, availability: available ? "available" : "missing" });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, availability: "unknown" });
      });
    return () => {
      cancelled = true;
    };
    // The track object is re-emitted per cover/state change: follow the song.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the song, not the object.
  }, [key, isBackgrounded]);

  if (!key) return "missing";
  return result?.key === key ? result.availability : "checking";
}
