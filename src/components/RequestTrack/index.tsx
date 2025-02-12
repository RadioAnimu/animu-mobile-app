import { Text, TouchableOpacity } from "react-native";
import { MusicRequestProps } from "../../api";
import { styles } from "./styles";
import { THEME } from "../../theme";
import { Image } from "expo-image";
import { CONFIG } from "../../utils/player.config";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

interface Props {
  musicToBeRequested: MusicRequestProps;
  onTrackRequest: () => void;
}

export function RequestTrack({ musicToBeRequested, onTrackRequest }: Props) {
  const { settings } = useUserSettings();

  return (
    <TouchableOpacity
      onPress={onTrackRequest}
      style={[
        styles.container,
        {
          backgroundColor: musicToBeRequested.requestable
            ? THEME.COLORS.PEDIDO_POSSIVEL
            : THEME.COLORS.PEDIDO_IMPOSSIVEL,
        },
      ]}
    >
      {settings.coversInRequestSearch && (
        <Image
          source={{ uri: musicToBeRequested.track.artworks.cover }}
          style={styles.image}
          placeholder={CONFIG.DEFAULT_COVER}
          onError={() => {
            return {
              uri: CONFIG.DEFAULT_COVER,
            };
          }}
          contentFit="cover"
          cachePolicy={settings.cacheEnabled ? "disk" : "none"}
        />
      )}
      <Text style={styles.text}>
        {musicToBeRequested.track.artist} | {musicToBeRequested.track.rawtitle}
      </Text>
    </TouchableOpacity>
  );
}
