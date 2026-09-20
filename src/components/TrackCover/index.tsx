import React from "react";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { Cover } from "@/components/Cover";
import { useResolvedArtwork } from "@/hooks/useResolvedArtwork";

export const TrackCover = React.memo(function TrackCover() {
  const player = usePlayer();
  const artwork = player.currentTrack?.artwork;
  // The now-playing cover joins the media session's own download instead
  // of racing it with a second fetch (`useResolvedArtwork` shares the
  // resolver's in-flight download). The remote URL is the fallback only
  // when the resolver's download failed.
  const cover =
    useResolvedArtwork(artwork, player.currentTrack?.artworks) ??
    player.defaultArtwork;

  if (!artwork) {
    return null;
  }

  return <Cover cover={cover} category="live" />;
});
