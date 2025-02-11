import { View } from "react-native";
import TextTicker from "react-native-text-ticker";
import { AnimuInfoProps } from "../../api";
import { IMGS } from "../../languages";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { Track } from "../../core/domain/track";

interface Props {
  track: Track;
}

export function Live({ track }: Props) {
  const { settings } = useUserSettings();

  const NoAr = IMGS[settings.selectedLanguage].LIVE_LABEL;

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
          {track.title}
        </TextTicker>
      </View>
    </View>
  );
}
