import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { CountdownTimerText } from "@/components/CountdownTimerText";
import { THEME } from "@/theme";

/** "Calculating" pulse — how dim it dips and how long each half takes. */
const BLINK_MIN = 0.35;
const BLINK_DURATION = 650;

export function TimeRemaining() {
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const dict = useDict();
  const isBackgrounded = useIsBackgrounded();
  const [blink] = useState(() => new Animated.Value(1));
  const syncing = player.syncing;

  // Don't show if it's a live program or if it's a transition track
  const shouldShow =
    !player.currentProgram?.isLive &&
    !player.currentTrack?.anime?.toLowerCase().includes("passagem");

  useEffect(() => {
    // Only pulse while the syncing label is actually rendered and visible.
    if (!syncing || !shouldShow || isBackgrounded) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: BLINK_MIN,
          duration: BLINK_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: BLINK_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      blink.setValue(1);
    };
  }, [syncing, shouldShow, isBackgrounded, blink]);

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
        {dict.CALCULATING}…
      </Animated.Text>
    );
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
  calculating: {
    color: THEME.COLORS.TEXT_DIM,
  },
});
