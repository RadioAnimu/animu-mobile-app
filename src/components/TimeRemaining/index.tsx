import { Animated, StyleSheet, Text, View } from "react-native";
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
    progress.durationMs,
    !isBackgrounded,
  );

  const blink = useBlink(syncing && showProgress && !isBackgrounded);

  const visible = showProgress && !!player.currentTrack;

  // The audible clock is still being measured — the elapsed time (and thus
  // the countdown) falls back to the wall clock and is known to be ahead of
  // the speaker, so show a muted "calculating" instead of a wrong number.
  const message = syncing ? (
    <Animated.Text
      maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
      numberOfLines={1}
      style={[styles.timeLeft, styles.calculating, { opacity: blink }]}
    >
      {dict.SYNCHRONIZING}…
    </Animated.Text>
  ) : (
    <Text
      maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
      numberOfLines={1}
      style={styles.timeLeft}
    >
      {dict.TIME_REMAINING}:{" "}
      <CountdownTimerText startTime={remainingMs} />
    </Text>
  );

  // The row keeps one height whatever it says, or says nothing (live shows,
  // jingles): an invisible countdown line sizes it and the message sits on
  // top (one line, so it can never outgrow the slot), so the info block
  // below never moves.
  return (
    <View style={styles.slot}>
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[styles.timeLeft, styles.sizer]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {dict.TIME_REMAINING}: <CountdownTimerText startTime={0} />
      </Text>
      {visible && <View style={styles.message}>{message}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width so a message wider than the sizer still fits on one line.
  slot: {
    alignSelf: "stretch",
    justifyContent: "center",
  },
  sizer: {
    opacity: 0,
  },
  message: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
  },
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
