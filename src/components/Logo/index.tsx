import { Image } from "react-native";
import { styles } from "./styles";
import { IMGS, selectedLanguage } from "../../languages";
import { useContext } from "react";
import { UserSettingsContext } from "../../contexts/user.settings.context";

interface Props {
  size?: number;
  img?: string;
}

export function Logo({ size, img }: Props) {
  const defaultSize = 100;
  const { userSettings } = useContext(UserSettingsContext);

  const defaultImg = IMGS[userSettings.selectedLanguage].LOGO;
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
