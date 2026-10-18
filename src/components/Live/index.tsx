import React from "react";
import { Text, View } from "react-native";
import { THEME } from "@/theme";
import { Marquee, MarqueeGroup } from "@/components/Marquee";
import { IMGS } from "@/i18n";
import { styles } from "@/components/Live/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { DEFAULT_ANIME_FALLBACK } from "@/core/domain/track";

export const Live = React.memo(function Live() {
  const { settings } = useUserSettings();
  const player = usePlayer();
  const copy = useCopyToClipboard();
  const LiveLabel = IMGS[settings.selectedLanguage].LIVE_LABEL;

  const track = player.currentTrack;

  // Before the first track lands the bar is already there, its lines blank,
  // so the program block below doesn't jump when the names arrive.
  if (!track) {
    return (
      <View style={styles.track}>
        <LiveLabel />
        <View
          style={styles.info}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {(["title", "artist", "song"] as const).map((line) => (
            <Text
              key={line}
              maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
              numberOfLines={1}
              style={[styles[line], styles.blank]}
            >
              –
            </Text>
          ))}
        </View>
      </View>
    );
  }

  // A song from no anime keeps the home screen's "Now Playing" label.
  const anime = track.anime || DEFAULT_ANIME_FALLBACK;

  return (
    <View style={styles.track}>
      <LiveLabel />
      <View style={styles.info}>
        <MarqueeGroup>
          <Marquee
            style={styles.title}
            text={anime}
            onPress={() => copy(anime)}
          />
          <Marquee
            style={styles.artist}
            text={track.artist}
            onPress={() => copy(track.artist)}
          />
          <Marquee
            style={styles.song}
            text={track.title}
            onPress={() => copy(track.title)}
          />
        </MarqueeGroup>
      </View>
    </View>
  );
});
