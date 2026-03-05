import { FlatList } from "react-native";
import { ButtonKBPS } from "../ButtonKBPS";
import { styles } from "./styles";
import { usePlayer } from "../../contexts/player/PlayerProvider";

export function ChooseBitrateSection() {
  const { changeStream, currentStream, streamOptions } = usePlayer();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={streamOptions}
      keyExtractor={(item) => item.url}
      renderItem={({ item }) => {
        return (
          <ButtonKBPS
            handleChangeStream={() => {
              changeStream(item);
            }}
            selected={item.url === currentStream?.url || false}
            category={item.category}
            kbps={item.bitrate}
          />
        );
      }}
    ></FlatList>
  );
}
