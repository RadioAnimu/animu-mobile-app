import { Image } from "react-native";
import { styles } from "./styles";
import { IMGS, selectedLanguage } from "../../languages";

interface Props {
  size?: number;
  img?: string;
}

export function Logo({ size, img }: Props) {
  const defaultSize = 100;
  const defaultImg = IMGS[selectedLanguage].LOGO;
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
