import { Text, StyleSheet } from "react-native";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { CountdownTimerText } from "@/components/CountdownTimerText";
import { THEME } from "@/theme";

export function TimeRemaining() {
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const dict = useDict();

  // Don't show if it's a live program or if it's a transition track
  const shouldShow =
    !player.currentProgram?.isLive &&
    !player.currentTrack?.anime?.toLowerCase().includes("passagem");

  if (!shouldShow || !player.currentTrack) {
    return null;
  }

  return (
    <Text style={styles.timeLeft}>
      {dict.TIME_REMAINING}:{" "}
      <CountdownTimerText
        startTime={
          (player.currentTrack?.duration || 0) - (currentTrackProgress || 0)
        }
      />
    </Text>
  );
}

const styles = StyleSheet.create({
  timeLeft: {
    fontSize: THEME.FONT_SIZE.BODY,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    textAlign: "center",
    color: THEME.COLORS.TEXT,
  },
});
