import React from "react";
import { View } from "react-native";
import { Marquee } from "../Marquee";
import { IMGS } from "../../i18n";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";

export const Live = React.memo(function Live() {
  const { settings } = useUserSettings();
  const player = usePlayer();
  const NoAr = IMGS[settings.selectedLanguage].LIVE_LABEL;

  const track = player.currentTrack;

  if (!track) return null;

  return (
    <View style={styles.track}>
      <NoAr />
      <View style={styles.info}>
        <Marquee style={styles.title} text={track.anime} />
        <Marquee style={styles.artist} text={track.artist} />
        <Marquee style={styles.song} text={track.title} />
      </View>
    </View>
  );
});
