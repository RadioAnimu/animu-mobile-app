import { Text, StyleSheet } from "react-native";
import {
  usePlayer,
  useTrackProgress,
} from "../../contexts/player/PlayerProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { CountdownTimerText } from "../CountdownTimerText";
import { DICT } from "../../languages";
import { THEME } from "../../theme";

export function TimeRemaining() {
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const { settings } = useUserSettings();

  // Don't show if it's a live program or if it's a transition track
  const shouldShow =
    !player.currentProgram?.isLive &&
    !player.currentTrack?.anime?.toLowerCase().includes("passagem");

  if (!shouldShow || !player.currentTrack) {
    return null;
  }

  return (
    <Text style={styles.timeLeft}>
      {DICT[settings.selectedLanguage].TIME_REMAINING}:{" "}
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
    fontSize: THEME.FONT_SIZE.SM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    textAlign: "center",
    color: THEME.COLORS.WHITE_TEXT,
  },
});
