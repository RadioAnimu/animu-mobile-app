import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";

/** Transport feedback remains separate from song metadata and artwork. */
export function PlaybackStatus() {
  const { playbackState, currentTrack, refreshData, play } = usePlayer();
  const dict = useDict();
  const { toast } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const connecting = playbackState === "connecting" || playbackState === "reconnecting";
  const failed = playbackState === "error";
  if (!connecting && !failed && currentTrack) return null;

  let message = dict.PLAYER_METADATA_UNAVAILABLE;
  if (failed) message = dict.PLAYER_PLAYBACK_FAILED;
  if (connecting) message = playbackState === "reconnecting" ? dict.PLAYER_RECONNECTING : dict.PLAYER_CONNECTING;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={styles.message}>
        {(connecting || refreshing) && <ActivityIndicator size="small" color={THEME.COLORS.SPINNER} />}
        <Text style={[styles.text, failed && styles.error]}>{message}</Text>
      </View>
      {(failed || !currentTrack) && !connecting && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          disabled={refreshing}
          activeOpacity={THEME.OPACITY.PRESSED}
          style={styles.retry}
          onPress={() => {
            if (inFlight.current) return;
            inFlight.current = true;
            setRefreshing(true);
            const operation = failed ? play : refreshData;
            void operation().catch(() => toast(dict.PLAYER_PLAYBACK_FAILED, "error"))
              .finally(() => { inFlight.current = false; setRefreshing(false); });
          }}
        >
          <Text style={styles.retryText}>{failed ? dict.A11Y_PLAY : dict.ERROR_RETRY}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: THEME.LAYOUT.CONTENT_WIDTH, maxWidth: THEME.LAYOUT.CONTENT_MAX_WIDTH, marginVertical: THEME.SPACE.MD, alignItems: "center" },
  message: { flexDirection: "row", gap: THEME.SPACE.SM, alignItems: "center" },
  text: { color: THEME.COLORS.TEXT_SOFT, fontFamily: THEME.FONT_FAMILY.REGULAR, fontSize: THEME.FONT_SIZE.BODY, textAlign: "center", flexShrink: 1 },
  error: { color: THEME.COLORS.ERROR },
  retry: { minHeight: THEME.LAYOUT.TOUCH_TARGET, justifyContent: "center", paddingHorizontal: THEME.SPACE.LG },
  retryText: { color: THEME.COLORS.BRAND, fontFamily: THEME.FONT_FAMILY.BOLD, fontSize: THEME.FONT_SIZE.BODY },
});
