import { useCallback } from "react";
import { FlatList, type ListRenderItem } from "react-native";
import type { Stream } from "@/core/domain/stream";
import { ButtonKBPS } from "@/components/ButtonKBPS";
import { styles } from "@/components/ChooseBitrateSection/styles";
import { usePlayer } from "@/contexts/player/PlayerProvider";

export function ChooseBitrateSection() {
  const { changeStream, currentStream, streamOptions } = usePlayer();

  const renderItem: ListRenderItem<Stream> =
    useCallback(
      ({ item }) => (
        <ButtonKBPS
          handleChangeStream={() => {
            changeStream(item);
          }}
          selected={item.url === currentStream?.url}
          category={item.category}
          kbps={item.bitrate}
        />
      ),
      [changeStream, currentStream?.url],
    );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={streamOptions}
      keyExtractor={(item) => item.url}
      renderItem={renderItem}
    />
  );
}
