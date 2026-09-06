import React from "react";
import { Pressable } from "react-native";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { Cover } from "../Cover";

interface Props {
  /** Opens the lyrics overlay — the cover is the now-playing surface. */
  onPress?: () => void;
}

export const TrackCover = React.memo(function TrackCover({ onPress }: Props) {
  const player = usePlayer();

  if (!player.currentTrack?.artwork) {
    return null;
  }

  if (!onPress) {
    return <Cover cover={player.currentTrack.artwork} />;
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Cover cover={player.currentTrack.artwork} />
    </Pressable>
  );
});
