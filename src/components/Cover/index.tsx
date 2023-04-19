import { Image } from "react-native";
import { styles } from "./styles";

interface Props {
    cover: string;
}

export function Cover({ cover }: Props) {
  return (
    <Image source={{
        uri: cover,
        }} style={styles.image} />
  );
}
