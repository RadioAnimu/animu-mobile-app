import { useMemo } from "react";
import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { View } from "react-native";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useBoundedRetry } from "@/hooks/useBoundedRetry";
import { buildAuthImageSource } from "@/utils/authImage";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

interface Props {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
}

/**
 * The one place avatars are rendered. It feeds the session token and a
 * cache-busting revision into the source so the authenticated avatar
 * endpoint loads reliably and refreshes after an upload, and degrades to a
 * neutral person glyph with bounded retries instead of a blank frame.
 */
export function Avatar({ uri, size = scale(40), style, iconSize }: Props) {
  const { user, imageVersion } = useAuth();
  const { failed, retry, fail } = useBoundedRetry(uri ?? "");

  const source = useMemo(
    () =>
      buildAuthImageSource(
        uri,
        user?.sessionToken,
        `${imageVersion}-${retry}`,
      ),
    [uri, user?.sessionToken, imageVersion, retry],
  );

  const dimensions = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (!source || failed) {
    return (
      <View
        style={[
          dimensions,
          { backgroundColor: THEME.COLORS.APP_BG },
          { alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        <MaterialIcons
          name="person"
          size={iconSize ?? Math.round(size * 0.6)}
          color={THEME.COLORS.TEXT_DIM}
        />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[dimensions, style]}
      contentFit="cover"
      transition={150}
      onError={fail}
    />
  );
}
