import { View, Text, Image } from "react-native";
import { styles } from "./styles";
import foninho from "../../assets/icons/foninho.png";
import { THEME } from "../../theme";

interface Props {
  listeners: number;
}

export function Listeners({ listeners }: Props) {
  return (
    <View style={styles.container}>
        <Text style={styles.text}>{listeners}</Text>
        <Image style={styles.foninho} source={foninho} />
        <Text style={styles.text}>HARU-CHAN</Text>
    </View>
  );
}
