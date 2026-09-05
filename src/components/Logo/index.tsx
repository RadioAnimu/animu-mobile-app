import { Image } from "react-native";
import { styles } from "./styles";
import { IMGS } from "../../i18n";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

interface Props {
  size?: number;
  img?: string;
}

const DEFAULT_SIZE = 100;

export function Logo({ size, img }: Props) {
  const { settings } = useUserSettings();

  const defaultImg = IMGS[settings.selectedLanguage].LOGO;
  return (
    <Image
      source={img ? img : defaultImg}
      style={[
        styles.image,
        {
          height: size ? size : DEFAULT_SIZE,
        },
      ]}
    />
  );
}
