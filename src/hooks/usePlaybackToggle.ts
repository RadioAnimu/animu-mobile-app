import { useRef, useState } from "react";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";

/** Shared play/pause action guard and semantic failure feedback. */
export function usePlaybackToggle(player: {
  isPlaying: boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const inFlight = useRef(false);
  const { toast } = useAlert();
  const dict = useDict();
  const toggle = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChanging(true);
    haptics.tap();
    try {
      const action = player.isPlaying ? player.pause : player.play;
      await action();
    } catch (error) {
      console.warn("[HeaderBar] play/pause failed:", error);
      haptics.error();
      toast(dict.PLAYER_PLAYBACK_FAILED, "error");
    } finally {
      inFlight.current = false;
      setChanging(false);
    }
  };
  return { changing, toggle };
}
