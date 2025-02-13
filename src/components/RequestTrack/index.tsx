import { Text, TouchableOpacity } from "react-native";
import { styles } from "./styles";
import { THEME } from "../../theme";
import { Image } from "expo-image";
import { CONFIG } from "../../utils/player.config";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { MusicRequest } from "../../core/domain/music-request";

interface Props {
  track: MusicRequest;
  onTrackRequest: () => void;
}

export function RequestTrack({ track, onTrackRequest }: Props) {
  const { settings } = useUserSettings();

  return (
    <TouchableOpacity
      onPress={onTrackRequest}
      style={[
        styles.container,
        {
          backgroundColor: track.requestable
            ? THEME.COLORS.PEDIDO_POSSIVEL
            : THEME.COLORS.PEDIDO_IMPOSSIVEL,
        },
      ]}
    >
      {settings.coversInRequestSearch && (
        <Image
          source={{ uri: track.artwork }}
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
        {track.artist} | {track.raw}
      </Text>
    </TouchableOpacity>
  );
}
