import { Text, View } from "react-native";
import { AnimuInfoProps } from "../../api";
import { styles } from "./styles";

interface Props {
  info: AnimuInfoProps;
}

export function Program({ info }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, styles.green]}>{info?.program.programa}</Text>
      <Text style={styles.label}>
        COM: <Text style={styles.green}>{info?.program.locutor}</Text>
      </Text>
    </View>
  );
}
