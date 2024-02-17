import { Image } from "react-native";
import { styles } from "./styles";

import logo from "../../assets/logo.png";

interface Props {
  size?: number;
  img?: string;
}

export function Logo({ size, img }: Props) {
  const defaultSize = 100;
  const defaultImg = logo;
  return (
    <Image
      source={img ? img : defaultImg}
      style={[
        styles.image,
        {
          height: size ? size : defaultSize,
        },
      ]}
    />
  );
}
