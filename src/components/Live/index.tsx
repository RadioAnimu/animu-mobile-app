import { useContext } from "react";
import { View } from "react-native";
import TextTicker from "react-native-text-ticker";
import { AnimuInfoProps } from "../../api";
import { UserSettingsContext } from "../../contexts/user.settings.context";
import { IMGS } from "../../languages";
import { styles } from "./styles";

interface Props {
  animuInfo: AnimuInfoProps["track"];
}

export function Live({ animuInfo }: Props) {
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
          {animuInfo.anime}
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
          {animuInfo.artist}
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
          {animuInfo.song}
        </TextTicker>
      </View>
    </View>
  );
}
