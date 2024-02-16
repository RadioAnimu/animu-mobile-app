import { FlatList } from "react-native";
import { MyPlayerProps } from "../../utils";
import { ButtonKBPS } from "../ButtonKBPS";
import { styles } from "./styles";

interface Props {
  player: MyPlayerProps;
}

export function ChooseBitrateSection({ player }: Props) {
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={player.CONFIG.STREAM_OPTIONS}
      keyExtractor={(item) => item.url}
      renderItem={({ item }) => {
        return (
          <ButtonKBPS
            handleChangeStream={() => {
              player.changeStream(item);
            }}
            selected={item === player._currentStream || false}
            category={item.category}
            kbps={item.bitrate}
            isSaijikkou={item.category === "REPRISES" ? true : false}
          />
        );
      }}
    ></FlatList>
  );
}
