import React from "react";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { Cover, CoverPlaceholder } from "@/components/Cover";
import { useResolvedArtwork } from "@/hooks/useResolvedArtwork";

interface Props {
  /** Square side of the frame where the layout measured room for it (split). */
  size?: number;
}

export const TrackCover = React.memo(function TrackCover({ size }: Readonly<Props>) {
  const player = usePlayer();
  const track = player.currentTrack;
  // The now-playing cover joins the media session's own download instead
  // of racing it with a second fetch (`useResolvedArtwork` shares the
  // resolver's in-flight download). The remote URL is the fallback only
  // when the resolver's download failed.
  const cover =
    useResolvedArtwork(track?.artwork || undefined, track?.artworks) ??
    player.defaultArtwork;

  // The frame stays while a cover is missing or still downloading (a title
  // heard before the station names it has none): the default cover holds
  // the square instead of the layout collapsing.
  if (!track || !cover) {
    return <CoverPlaceholder size={size} />;
  }

  return <Cover cover={cover} category="live" preserveAspectRatio size={size} />;
});
