import React from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import headphones from "@/assets/icons/headphones.webp";
import headphonesWhite from "@/assets/icons/headphones_white.webp";
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

  // Until the count and the track are known the same chip renders invisible
  // (default label, a11y-hidden), holding the row so the cover below doesn't
  // drop when the data lands.
  const ready = !!currentListeners && !!track;
  const isRequest = ready && track.isRequest;
  const isLive = ready && !!program?.isLive;
  const highlighted = isRequest || isLive;
  const palette = listenersPalette(isRequest, isLive);
  const label = listenersLabel(isRequest, isLive, program?.dj, dict);
  const count = currentListeners?.value ?? 0;

  return (
    <View
      {...(ready
        ? {
            accessible: true,
            accessibilityLiveRegion: "polite" as const,
            accessibilityLabel: `${count} ${label}`,
          }
        : {
            "aria-hidden": true,
          })}
      style={[
        styles.container,
        { backgroundColor: palette.background },
        !ready && styles.placeholder,
      ]}
    >
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[styles.text, { color: palette.text }]}
      >
        {count}
      </Text>
      <Image
        contentFit="contain"
        style={styles.headphones}
        source={highlighted ? headphonesWhite : headphones}
      />
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
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
