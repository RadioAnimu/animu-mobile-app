import React from "react";
import { View } from "react-native";
import { Marquee, MarqueeGroup } from "@/components/Marquee";
import { IMGS } from "@/i18n";
import { styles } from "@/components/Live/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { usePlayer } from "@/contexts/player/PlayerProvider";

export const Live = React.memo(function Live() {
  const { settings } = useUserSettings();
  const player = usePlayer();
  const copy = useCopyToClipboard();
  const LiveLabel = IMGS[settings.selectedLanguage].LIVE_LABEL;

  const track = player.currentTrack;

  if (!track) return null;

  return (
    <View style={styles.track}>
      <LiveLabel />
      <View style={styles.info}>
        <MarqueeGroup>
          <Marquee
            style={styles.title}
            text={track.anime}
            onPress={() => copy(track.anime)}
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
