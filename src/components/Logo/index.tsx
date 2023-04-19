import { Image } from "react-native";
import { styles } from "./styles";

import logo from "../../assets/logo.png";

interface Props {
  size?: number;
}

export function Logo({ size }: Props) {
  const defaultSize = 100;
  return (
    <Image
        source={logo}
        style={[
            styles.image,
            {
                height: size ? size : defaultSize,
            }
        ]}
    />
  );
}
