import { useCallback, useRef, useState } from "react";
import { FlatList, type ListRenderItem } from "react-native";
import type { Stream } from "@/core/domain/stream";
import { ButtonKBPS } from "@/components/ButtonKBPS";
import { styles } from "@/components/ChooseBitrateSection/styles";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";

export function ChooseBitrateSection() {
  const { toast } = useAlert();
  const dict = useDict();
  const changing = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const { changeStream, currentStream, streamOptions } = usePlayer();

  const renderItem: ListRenderItem<Stream> =
    useCallback(
      ({ item }) => (
        <ButtonKBPS
          busy={pending === item.url}
          disabled={pending != null}
          handleChangeStream={() => {
            if (changing.current || item.url === currentStream?.url) return;
            changing.current = true;
            setPending(item.url);
            haptics.select();
            void changeStream(item).catch(() => {
              haptics.error();
              toast(dict.PLAYER_PLAYBACK_FAILED, "error");
            }).finally(() => { changing.current = false; setPending(null); });
          }}
          selected={item.url === currentStream?.url}
          category={item.category}
          kbps={item.bitrate}
        />
      ),
      [changeStream, currentStream?.url, pending, toast, dict.PLAYER_PLAYBACK_FAILED],
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
