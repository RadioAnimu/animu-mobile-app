import { useEffect, useState } from "react";
import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";
import { styles } from "@/components/Cover/styles";
import { THEME } from "@/theme";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  coverCacheRegistry,
  type CoverCacheCategory,
} from "@/core/services/cover-cache-registry.service";

/** Bundled fallback — no network needed, always renders, instant placeholder. */
const DEFAULT_COVER = require("@app/assets/default-cover.png");

/**
 * A transient failure self-heals: after a failed load, retry after a
 * short delay (up to MAX_FAILURES total failures) instead of pinning the
 * fallback until the next track change. The media session's resolver
 * downloads the same URLs successfully — most in-app failures are
 * transient (canceled loads during fast track transitions, flaky cells).
 */
const RETRY_DELAY_MS = 3000;
const MAX_FAILURES = 2;

type CachePolicy = "none" | "disk" | "memory" | "memory-disk";

interface Props {
  cover: string;
  /** Overrides the default (now-playing) frame — e.g. list rows. */
  style?: StyleProp<ImageStyle>;
  /** Overrides the cacheEnabled setting when provided. */
  cachePolicy?: CachePolicy;
  /**
   * Stable per-item key so expo-image recycles the native view in lists.
   * Falls back to the cover URL: expo-image deliberately keeps the previous
   * drawable until the next source finishes loading, so without a key that
   * changes with the URL a track change can keep showing the old artwork
   * (especially once the disk cache/seed path delays the new load).
   */
  recyclingKey?: string;
  /**
   * Which surface this cover was displayed in (player live, last
   * requests…) — feeds the Settings storage card's per-category sizes.
   * Only meaningful while the disk cache is on.
   */
  category?: CoverCacheCategory;
}

/**
 * Every cover the app renders goes through here: real error fallback
 * (expo-image's onError is an event, not a source swap — the old
 * `return {uri}` pattern did nothing), bundled placeholder while
 * loading, and the user's cache setting as the default policy.
 *
 * The failure is tracked PER URL and the fallback is DERIVED
 * (`failure.url === cover`) — two properties this component once lacked
 * and fast track transitions exposed:
 *
 * - an error event from a superseded/canceled load (jingle → music)
 *   arrives late and must never pin the CURRENT url on the fallback;
 * - the fallback state must be correct on the very render a new URL
 *   arrives — an effect-based reset flashes one frame of fallback on
 *   every transition.
 *
 * While loading, the frame is a solid surface with the placeholder
 * filling it — expo-image's placeholder defaults to `scale-down`, which
 * renders the bundled asset at intrinsic size inside a transparent
 * frame (small logo, background showing through).
 */
export function Cover({ cover, style, cachePolicy, recyclingKey, category }: Props) {
  const { settings } = useUserSettings();
  const [failure, setFailure] = useState<{
    url: string;
    attempts: number;
  } | null>(null);

  // Attribute the cached file to this surface — what the storage card reports.
  useEffect(() => {
    if (category && settings.cacheEnabled) {
      coverCacheRegistry.tag(cover, category);
    }
  }, [cover, category, settings.cacheEnabled]);

  const showFallback = failure?.url === cover;

  // Self-heal transient failures (bounded — a dead URL stops retrying)
  useEffect(() => {
    if (!failure || failure.url !== cover || failure.attempts >= MAX_FAILURES) {
      return;
    }
    const timer = setTimeout(() => setFailure(null), RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [failure, cover]);

  return (
    <Image
      source={showFallback ? DEFAULT_COVER : { uri: cover }}
      style={[{ backgroundColor: THEME.COLORS.APP_BG }, style ?? styles.image]}
      placeholder={DEFAULT_COVER}
      placeholderContentFit="cover"
      onError={() =>
        setFailure((prev) =>
          prev?.url === cover
            ? { url: cover, attempts: prev.attempts + 1 }
            : { url: cover, attempts: 1 },
        )
      }
      cachePolicy={cachePolicy ?? (settings.cacheEnabled ? "disk" : "none")}
      contentFit="cover"
      recyclingKey={recyclingKey ?? cover}
    />
  );
}
