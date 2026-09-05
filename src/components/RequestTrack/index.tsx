import { Text, TouchableOpacity } from "react-native";
import { styles } from "./styles";
import { THEME } from "../../theme";
import { Cover } from "../Cover";
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
            ? THEME.COLORS.ROW_ACTIVE
            : THEME.COLORS.ROW_INACTIVE,
        },
      ]}
    >
      {settings.coversInRequestSearch && (
        <Cover cover={track.artwork} style={styles.image} />
      )}
      <Text style={styles.text}>
        {track.artist} | {track.raw}
      </Text>
    </TouchableOpacity>
  );
}
