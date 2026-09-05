import React, { useEffect, useState } from "react";
import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

/** Bundled fallback — no network needed, always renders, instant placeholder. */
const DEFAULT_COVER = require("../../../assets/default-cover.png");

type CachePolicy = "none" | "disk" | "memory" | "memory-disk";

interface Props {
  cover: string;
  /** Overrides the default (now-playing) frame — e.g. list rows. */
  style?: StyleProp<ImageStyle>;
  /** Overrides the cacheEnabled setting when provided. */
  cachePolicy?: CachePolicy;
}

/**
 * Every cover the app renders goes through here: real error fallback
 * (expo-image's onError is an event, not a source swap — the old
 * `return {uri}` pattern did nothing), bundled placeholder while
 * loading, and the user's cache setting as the default policy.
 */
export function Cover({ cover, style, cachePolicy }: Props) {
  const { settings } = useUserSettings();
  const [failed, setFailed] = useState(false);

  // A new URL gets a fresh chance, even if the previous one failed
  useEffect(() => {
    setFailed(false);
  }, [cover]);

  return (
    <Image
      source={failed ? DEFAULT_COVER : { uri: cover }}
      style={style ?? styles.image}
      placeholder={DEFAULT_COVER}
      onError={() => setFailed(true)}
      cachePolicy={cachePolicy ?? (settings.cacheEnabled ? "disk" : "none")}
      contentFit="cover"
    />
  );
}
