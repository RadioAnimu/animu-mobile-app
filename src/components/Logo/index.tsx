import { Image } from "react-native";
import { styles } from "./styles";
import { IMGS, selectedLanguage } from "../../languages";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

interface Props {
  size?: number;
  img?: string;
}

export function Logo({ size, img }: Props) {
  const defaultSize = 100;
  const { settings } = useUserSettings();

  const defaultImg = IMGS[settings.selectedLanguage].LOGO;
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
