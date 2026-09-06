import React from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Marquee, MarqueeGroup } from "../Marquee";
import { DICT, IMGS } from "../../i18n";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { useAlert } from "../../contexts/alert/AlertProvider";

export const Live = React.memo(function Live() {
  const { settings } = useUserSettings();
  const player = usePlayer();
  const alert = useAlert();
  const NoAr = IMGS[settings.selectedLanguage].LIVE_LABEL;

  const track = player.currentTrack;

  if (!track) return null;

  const copy = (text: string) => {
    Clipboard.setStringAsync(text);
    alert.toast(DICT[settings.selectedLanguage].TEXT_COPIED);
  };

  return (
    <View style={styles.track}>
      <NoAr />
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
