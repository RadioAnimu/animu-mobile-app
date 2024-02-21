import { Image } from "expo-image";
import { styles } from "./styles";
import { CONFIG } from "../../utils/player.config";
import { useContext } from "react";
import { UserSettingsContext } from "../../contexts/user.settings.context";

interface Props {
  cover: string;
}

export function Cover({ cover }: Props) {
  const { userSettings } = useContext(UserSettingsContext);

  return (
    <Image
      source={{
        uri:
          userSettings.liveQualityCover === "off"
            ? CONFIG.DEFAULT_COVER
            : cover,
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
      cachePolicy={userSettings.cacheEnabled ? "disk" : "none"}
    />
  );
}
