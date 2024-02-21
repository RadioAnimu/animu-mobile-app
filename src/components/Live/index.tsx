import { View } from "react-native";
import TextTicker from "react-native-text-ticker";
import { TrackProps } from "../../api";
import { styles } from "./styles";
import { IMGS, selectedLanguage } from "../../languages";
import { useContext } from "react";
import { UserSettingsContext } from "../../contexts/user.settings.context";

interface Props {
  track: TrackProps;
}

export function Live({ track }: Props) {
  const { userSettings } = useContext(UserSettingsContext);

  const NoAr = IMGS[userSettings.selectedLanguage].LIVE_LABEL;

  return (
    <View style={styles.track}>
      <NoAr />
      <View style={styles.info}>
        <TextTicker
          style={styles.title}
          duration={6000}
          loop
          repeatSpacer={20}
          bounce={false}
          marqueeDelay={1000}
          shouldAnimateTreshold={10}
        >
          {track.anime}
        </TextTicker>
        <TextTicker
          style={styles.artist}
          duration={6000}
          loop
          bounce={false}
          repeatSpacer={20}
          marqueeDelay={1000}
          shouldAnimateTreshold={10}
        >
          {track.artist}
        </TextTicker>
        <TextTicker
          style={styles.song}
          duration={6000}
          loop
          bounce={false}
          repeatSpacer={20}
          marqueeDelay={1000}
          shouldAnimateTreshold={10}
        >
          {track.song}
        </TextTicker>
      </View>
    </View>
  );
}
