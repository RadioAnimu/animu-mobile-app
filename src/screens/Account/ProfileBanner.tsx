import { Image, type ImageSource } from "expo-image";
import { View } from "react-native";

import { useBoundedRetry } from "@/hooks/useBoundedRetry";
import { styles } from "@/screens/Account/styles";

interface Props {
  source: ImageSource | undefined;
  /** The provider accent shown while the image loads or after it fails. */
  fallbackColor: string;
  /**
   * Bumped when the underlying profile media changes (imageVersion), so a
   * fresh banner re-enters the retry loop instead of sticking on a failed
   * frame.
   */
  revision: string | number;
}

/**
 * The profile banner, with the same never-blank contract as `Avatar`:
 * the colored fallback always renders underneath, the image fades in on
 * top, and a bounded retry loop re-attempts transient network/401 failures
 * instead of leaving an empty strip. If every attempt fails the strip
 * simply stays the accent color — the layout never collapses.
 */
export function ProfileBanner({ source, fallbackColor, revision }: Props) {
  const { failed, fail } = useBoundedRetry(revision);

  return (
    <View style={[styles.banner, { backgroundColor: fallbackColor }]}>
      {source && !failed && (
        <Image
          source={source}
          style={styles.bannerImage}
          contentFit="cover"
          transition={150}
          onError={fail}
        />
      )}
    </View>
  );
}
