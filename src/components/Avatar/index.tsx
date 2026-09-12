import { useEffect, useMemo, useState } from "react";
import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { buildAuthImageSource } from "../../utils/authImage";
import { THEME } from "../../theme";

/** Transient failures self-heal, mirroring the `Cover` component. */
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 2;

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
export function Avatar({ uri, size = 40, style, iconSize }: Props) {
  const { user, imageVersion } = useAuth();
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  // Adjust state during render so a new URL never flashes the fallback.
  const [trackedUri, setTrackedUri] = useState(uri);
  if (trackedUri !== uri) {
    setTrackedUri(uri);
    setFailed(false);
    setRetry(0);
  }

  const source = useMemo(
    () =>
      buildAuthImageSource(
        uri,
        user?.sessionToken,
        `${imageVersion}-${retry}`,
      ),
    [uri, user?.sessionToken, imageVersion, retry],
  );

  // A superseded/failed load must not pin the fallback forever.
  useEffect(() => {
    if (!failed || retry >= MAX_RETRIES) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setRetry((value) => value + 1);
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [failed, retry]);

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
      onError={() => setFailed(true)}
    />
  );
}
