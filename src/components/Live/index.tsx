import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  // The strip is full-bleed; in landscape its label and lines step in past
  // a notch / camera cutout (both insets are zero in portrait).
  const { left, right } = useSafeAreaInsets();
  const trackStyle = [styles.track, { paddingLeft: left, paddingRight: right }];

  const track = player.currentTrack;
  // A song from no anime keeps the home screen's "Now Playing" label.
  const anime = track?.anime || DEFAULT_ANIME_FALLBACK;
  const artist = track?.artist ?? "";
  const title = track?.title ?? "";
  // Stable handlers keep the memoized marquees from re-rendering on every
  // player update (play/pause, syncing) that leaves the text unchanged.
  const copyAnime = useCallback(() => copy(anime), [copy, anime]);
  const copyArtist = useCallback(() => copy(artist), [copy, artist]);
  const copyTitle = useCallback(() => copy(title), [copy, title]);

  // Before the first track lands the bar is already there, its lines blank,
  // so the program block below doesn't jump when the names arrive.
  if (!track) {
    return (
      <View style={trackStyle}>
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

  return (
    <View style={trackStyle}>
      <LiveLabel />
      <View style={styles.info}>
        <MarqueeGroup>
          <Marquee
            style={styles.title}
            text={anime}
            onPress={copyAnime}
          />
          <Marquee
            style={styles.artist}
            text={artist}
            onPress={copyArtist}
          />
          <Marquee
            style={styles.song}
            text={title}
            onPress={copyTitle}
          />
        </MarqueeGroup>
      </View>
    </View>
  );
});
