import { Animated, StyleSheet, Text } from "react-native";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { useBlink } from "@/hooks/useBlink";
import { useSmoothedElapsed } from "@/hooks/useSmoothedElapsed";
import { CountdownTimerText } from "@/components/CountdownTimerText";
import { isFillerTransition } from "@/core/domain/track";
import { THEME } from "@/theme";

export function TimeRemaining() {
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const dict = useDict();
  const isBackgrounded = useIsBackgrounded();
  const syncing = player.syncing;
  const smoothedElapsed = useSmoothedElapsed(
    currentTrackProgress,
    player.currentTrack?.raw,
  );

  // Don't show if it's a live program or if it's a transition track
  const shouldShow =
    !player.currentProgram?.isLive &&
    !isFillerTransition(player.currentTrack);

  const blink = useBlink(syncing && shouldShow && !isBackgrounded);

  if (!shouldShow || !player.currentTrack) {
    return null;
  }

  // The audible clock is still being measured — the elapsed time (and thus
  // the countdown) falls back to the wall clock and is known to be ahead of
  // the speaker, so show a muted "calculating" instead of a wrong number.
  if (syncing) {
    return (
      <Animated.Text
        style={[styles.timeLeft, styles.calculating, { opacity: blink }]}
      >
        {dict.SYNCHRONIZING}…
      </Animated.Text>
    );
  }

  return (
    <Text style={styles.timeLeft}>
      {dict.TIME_REMAINING}:{" "}
      <CountdownTimerText
        startTime={Math.max(
          0,
          (player.currentTrack?.duration || 0) - (smoothedElapsed ?? 0),
        )}
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
  calculating: {
    color: THEME.COLORS.TEXT_DIM,
  },
});
