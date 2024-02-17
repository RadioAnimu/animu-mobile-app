import { Image, Text, TouchableOpacity } from "react-native";
import { MusicRequestProps } from "../../api";
import { styles } from "./styles";
import { THEME } from "../../theme";

interface Props {
  musicToBeRequested: MusicRequestProps;
  onTrackRequest: () => void;
}

export function RequestTrack({ musicToBeRequested, onTrackRequest }: Props) {
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
      <Image
        source={{ uri: musicToBeRequested.track.artworks.cover }}
        style={styles.image}
      />
      <Text style={styles.text}>
        {musicToBeRequested.track.artist} | {musicToBeRequested.track.rawtitle}
      </Text>
    </TouchableOpacity>
  );
}
