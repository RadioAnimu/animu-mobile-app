import React from "react";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { Cover } from "@/components/Cover";

export const TrackCover = React.memo(function TrackCover() {
  const player = usePlayer();

  if (!player.currentTrack?.artwork) {
    return null;
  }

  return <Cover cover={player.currentTrack.artwork} category="live" />;
});
