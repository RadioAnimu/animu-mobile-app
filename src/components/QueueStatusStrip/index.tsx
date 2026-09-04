import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import type { QueueStatus } from "../../core/player/queue-tracker";
import { DICT } from "../../i18n";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { THEME } from "../../theme";
import { styles } from "./styles";

/** Display clamp for the cadence hint (minutes) — the ~6-row window is noisy. */
const MIN_CADENCE_MIN = 5;
const MAX_CADENCE_MIN = 120;

interface Props {
  status: QueueStatus;
}

/**
 * Provable queue status for the user's own requests. Renders nothing while
 * there is nothing to say (no pendings, nothing on air).
 */
export const QueueStatusStrip = React.memo(function QueueStatusStrip({
  status,
}: Props) {
  const { settings } = useUserSettings();
  const lang = settings.selectedLanguage;
  const dict = DICT[lang];

  const cadenceMinutes = (() => {
    if (status.cadenceMs == null) return null;
    const minutes = Math.round(status.cadenceMs / 60_000);
    return Math.min(MAX_CADENCE_MIN, Math.max(MIN_CADENCE_MIN, minutes));
  })();

  if (status.playingNow) {
    return (
      <View style={[styles.strip, styles.playingNow]}>
        <Ionicons
          name="play-circle"
          size={16}
          color={THEME.COLORS.WHITE_TEXT}
        />
        <Text style={[styles.text, styles.playingNowText]}>
          {dict.QUEUE_PLAYING_NOW}
        </Text>
      </View>
    );
  }

  if (status.pending.length === 0) return null;

  const details: string[] = [];
  if (status.playedAhead > 0) {
    details.push(dict.QUEUE_PLAYED_AHEAD.replace("%1", String(status.playedAhead)));
  }
  if (cadenceMinutes != null) {
    details.push(dict.QUEUE_CADENCE.replace("%1", String(cadenceMinutes)));
  }

  return (
    <View style={styles.strip}>
      <Ionicons
        name="musical-notes"
        size={16}
        color={THEME.COLORS.CAPTION_500}
      />
      <View style={styles.textColumn}>
        <Text style={styles.text}>{dict.QUEUE_IN_LINE}</Text>
        {details.length > 0 && (
          <Text style={styles.details}>{details.join("  ·  ")}</Text>
        )}
      </View>
    </View>
  );
});
