import { Image } from "expo-image";
import { styles } from "./styles";
import { CONFIG } from "../../utils/player.config";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

interface Props {
  cover: string;
}

export function Cover({ cover }: Props) {
  const { settings } = useUserSettings();

  return (
    <Image
      source={{
        uri: cover,
      }}
      style={styles.image}
      placeholder={{
        uri: CONFIG.DEFAULT_COVER,
      }}
      onError={() => {
        return {
          uri: CONFIG.DEFAULT_COVER,
        };
      }}
      cachePolicy={settings.cacheEnabled ? "disk" : "none"}
      contentFit="cover"
    />
  );
}
