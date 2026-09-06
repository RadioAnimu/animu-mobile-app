import React, { useEffect, useSyncExternalStore } from "react";
import { lyricsService, lyricsStore } from "../../core/lyrics";
import type { LyricsSnapshot } from "../../core/lyrics/types";
import { usePlayer } from "../player/PlayerProvider";

// ─── Lyrics sync trigger ───
//
// Deliberately NOT a value-carrying context: the lyrics snapshot lives in
// its own external store (`lyricsStore`), and this provider's only job is
// to notice "the song changed" and hand it to the service. Rendering
// `children` as-is keeps the whole route tree from re-rendering when a
// lyrics snapshot lands. Consumers read `useLyrics()`.
//
// Player info comes through the same door every player-facing component
// uses — `usePlayer()` (see Live/HeaderBar) — never the raw store.

export const LyricsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const currentTrack = usePlayer().currentTrack;

  const syncKey = currentTrack
    ? `${currentTrack.id}|${currentTrack.title}|${currentTrack.artist}|${currentTrack.startTime?.getTime()}`
    : null;

  useEffect(() => {
    void lyricsService.syncTrack(currentTrack);
    // Re-sync only when the song identity changes — the track object is
    // re-emitted by every poll, so object identity can't be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  return <>{children}</>;
};

/** Current lyrics snapshot (status, lines, match meta). */
export const useLyrics = (): LyricsSnapshot =>
  useSyncExternalStore(lyricsStore.subscribe, lyricsStore.getSnapshot);
