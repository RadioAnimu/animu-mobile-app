import { Text, TouchableOpacity, View } from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { MyPlayerProps } from "../../utils";
import { ButtonKBPS } from "../ButtonKBPS";

interface Props {
    player: MyPlayerProps;
}

export function ChooseBitrateSection({ player }: Props) {
  return (
    <View style={styles.container}>
        {Object.entries(player.CONFIG.BITRATES).map(([key, value]) => (
            <ButtonKBPS 
            handleChangeBitrate={() => { 
                player.changeBitrate(+key as keyof typeof player.CONFIG.BITRATES);
            }}
            key={key} selected={+key === player.curretnBitrate || false} category={value.category} kbps={value.kbps} />
        ))}
    </View>
  );
}
