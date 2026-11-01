import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { IMGS } from "@/i18n";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { scale } from "@/theme/responsive";

interface Props {
  size?: number;
  img?: number;
}

const DEFAULT_SIZE = scale(100);
/** Used when a source's intrinsic dimensions can't be resolved. */
const FALLBACK_ASPECT_RATIO = 1200 / 630;

export function Logo({ size, img }: Readonly<Props>) {
  const { settings } = useUserSettings();

  const source = img ?? IMGS[settings.selectedLanguage].LOGO;
  const height = size || DEFAULT_SIZE;

  // Unlike RN's Image, expo-image does not derive an intrinsic layout size from
  // the source, so an image with only a height collapses to zero width. Derive
  // the width from the source's aspect ratio.
  // expo-asset knows a bundled image's dimensions on every platform
  // (react-native-web has no `Image.resolveAssetSource`).
  const resolved = Asset.fromModule(source);
  const aspectRatio =
    resolved?.width && resolved?.height
      ? resolved.width / resolved.height
      : FALLBACK_ASPECT_RATIO;

  return (
    <Image
      contentFit="contain"
      source={source}
      style={{
        height,
        width: height * aspectRatio,
      }}
    />
  );
}
