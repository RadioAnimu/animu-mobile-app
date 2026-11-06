import { View } from "react-native";
import { ButtonKBPS } from "@/components/ButtonKBPS";
import { styles } from "@/components/ChooseBitrateSection/styles";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";
import { shownQuality } from "@/utils/stream-quality";

/**
 * The stream picker: a handful of pills in one centered row that wraps
 * (rather than scrolls) when large text grows them, so no pill is ever cut
 * off at the edge.
 *
 * Under automatic quality (Settings) the pill marked is the stream heard; a
 * tap picks a stream, which leaves automatic quality.
 */
export function ChooseBitrateSection() {
  const player = usePlayer();
  const { changeStream, autoQuality, streamOptions } = player;
  const dict = useDict();
  const shown = shownQuality(player);

  return (
    <View style={styles.container}>
      {(streamOptions ?? []).map((item) => {
        const selected = item.id === shown.stream?.id;
        const switching = selected && shown.switching;
        const autoHint = selected && autoQuality ? dict.QUALITY_AUTO_OPTION : undefined;
        const hint = switching ? dict.A11Y_QUALITY_SWITCHING : autoHint;
        return (
          <ButtonKBPS
            key={item.url}
            handleChangeStream={() => {
              // A selection tick only when the choice actually changes.
              if (autoQuality || !selected) haptics.select();
              void changeStream(item);
            }}
            selected={selected}
            switching={switching}
            labelSuffix={hint}
            category={item.category}
            kbps={item.bitrate}
          />
        );
      })}
    </View>
  );
}
