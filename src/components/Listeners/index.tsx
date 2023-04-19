import { View, Text } from "react-native";
import { styles } from "./styles";

import { Headphones } from "phosphor-react-native";
import { THEME } from "../../theme";

interface Props {
  listeners: number;
}

export function Listeners({ listeners }: Props) {
  return (
    <View style={styles.container}>
        <Text style={styles.text}>{listeners}</Text>
        <Headphones size={THEME.FONT_SIZE.LG} color={THEME.COLORS.PRIMARY} weight="fill" />
        <Text style={styles.text}>HARU-CHAN</Text>
    </View>
  );
}
