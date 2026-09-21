import { Image } from "expo-image";
import { styles } from "@/components/Logo/styles";
import { IMGS } from "@/i18n";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { scale } from "@/theme/responsive";

interface Props {
  size?: number;
  img?: string;
}

const DEFAULT_SIZE = scale(100);

export function Logo({ size, img }: Props) {
  const { settings } = useUserSettings();

  const defaultImg = IMGS[settings.selectedLanguage].LOGO;
  return (
    <Image
      contentFit="contain"
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
