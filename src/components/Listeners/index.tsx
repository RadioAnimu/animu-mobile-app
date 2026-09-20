import React from "react";
import { Image, Text, View } from "react-native";
import headphones from "@/assets/icons/headphones.png";
import headphonesWhite from "@/assets/icons/headphones_white.png";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { styles } from "@/components/Listeners/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { usePlayer, useStation } from "@/contexts/player/PlayerProvider";
import type { Dict } from "@/i18n";

/** The bar's palette: a request is purple, a live DJ red, otherwise brand. */
function listenersPalette(isRequest: boolean, isLive: boolean) {
  if (isRequest) {
    return { background: THEME.COLORS.FRAME, text: THEME.COLORS.TEXT };
  }
  if (isLive) {
    return { background: THEME.COLORS.LIVE, text: THEME.COLORS.TEXT };
  }
  return { background: THEME.COLORS.BRAND, text: THEME.COLORS.FRAME };
}

/** What the bar says: the live DJ's name, "requested", or the Haru-chan tag. */
function listenersLabel(
  isRequest: boolean,
  isLive: boolean,
  dj: string | undefined,
  dict: Dict,
): string {
  if (isLive) return (dj ?? "").toUpperCase();
  if (isRequest) return dict.TRACK_REQUEST;
  return dict.HARU_CHAN_TEXT;
}

export const Listeners = React.memo(function Listeners() {
  const { settings } = useUserSettings();
  const dict = useDict();
  const { currentListeners } = useStation();
  const { currentTrack, currentProgram } = usePlayer();

  const track = currentTrack;
  const program = currentProgram;

  if (!currentListeners || !track) return null;

  const isLive = !!program?.isLive;
  const highlighted = track.isRequest || isLive;
  const palette = listenersPalette(track.isRequest, isLive);
  const label = listenersLabel(track.isRequest, isLive, program?.dj, dict);

  return (
    <View
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <Text style={[styles.text, { color: palette.text }]}>
        {currentListeners.value}
      </Text>
      <Image
        style={styles.headphones}
        source={highlighted ? headphonesWhite : headphones}
      />
      <Text
        style={[
          styles.text,
          { color: palette.text },
          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.LINE_HEIGHT.HEADING,
            fontSize: highlighted
              ? THEME.FONT_SIZE.HEADING - scale(3.8)
              : THEME.FONT_SIZE.HEADING,
            marginLeft: scale(-1.2),
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
});
