import { View } from "react-native";
import { ButtonKBPS } from "@/components/ButtonKBPS";
import { styles } from "@/components/ChooseBitrateSection/styles";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { haptics } from "@/utils/haptics";

/**
 * The stream picker: a handful of pills in one centered row that wraps
 * (rather than scrolls) when large text grows them, so no pill is ever cut
 * off at the edge.
 */
export function ChooseBitrateSection() {
  const { changeStream, currentStream, streamOptions } = usePlayer();

  return (
    <View style={styles.container}>
      {(streamOptions ?? []).map((item) => (
        <ButtonKBPS
          key={item.url}
          handleChangeStream={() => {
            // A selection tick only when the choice actually changes.
            if (item.url !== currentStream?.url) haptics.select();
            changeStream(item);
          }}
          selected={item.url === currentStream?.url}
          category={item.category}
          kbps={item.bitrate}
        />
      ))}
    </View>
  );
}
