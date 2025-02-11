import { FlatList } from "react-native";
import { ButtonKBPS } from "../ButtonKBPS";
import { styles } from "./styles";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { CONFIG } from "../../utils/player.config";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

export function ChooseBitrateSection() {
  const { changeStream, currentStream } = usePlayer();
  const { settings } = useUserSettings();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={CONFIG.STREAM_OPTIONS}
      keyExtractor={(item) => item.url}
      renderItem={({ item }) => {
        return (
          <ButtonKBPS
            handleChangeStream={() => {
              changeStream(item, settings.liveQualityCover);
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
