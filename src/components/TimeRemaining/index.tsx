import { Animated, StyleSheet, Text } from "react-native";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { useBlink } from "@/hooks/useBlink";
import { useRemainingMs } from "@/hooks/useRemainingMs";
import { CountdownTimerText } from "@/components/CountdownTimerText";
import { THEME } from "@/theme";

export function TimeRemaining() {
  const player = usePlayer();
  const progress = useTrackProgress();
  const { showProgress } = progress;
  const dict = useDict();
  const isBackgrounded = useIsBackgrounded();
  const syncing = player.syncing;
  const remainingMs = useRemainingMs(
    progress,
    player.currentTrack?.duration || 0,
    !isBackgrounded,
  );

  const blink = useBlink(syncing && showProgress && !isBackgrounded);

  if (!showProgress || !player.currentTrack) {
    return null;
  }

  // The audible clock is still being measured — the elapsed time (and thus
  // the countdown) falls back to the wall clock and is known to be ahead of
  // the speaker, so show a muted "calculating" instead of a wrong number.
  if (syncing) {
    return (
      <Animated.Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[styles.timeLeft, styles.calculating, { opacity: blink }]}
      >
        {dict.SYNCHRONIZING}…
      </Animated.Text>
    );
  }

  return (
    <Text
      maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
      style={styles.timeLeft}
    >
      {dict.TIME_REMAINING}:{" "}
      <CountdownTimerText startTime={remainingMs} />
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
