import { useEffect, useRef, useState } from "react";
import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";
import DEFAULT_COVER from "@app/assets/default-cover.png";
import { styles } from "@/components/Cover/styles";
import { THEME } from "@/theme";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { RETRY_DELAY_MS } from "@/hooks/useBoundedRetry";
import {
  coverCacheRegistry,
  type CoverCacheCategory,
} from "@/core/services/cover-cache-registry.service";

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
  // Failure count lives per URL in a ref, NOT in the state that derives the
  // fallback: clearing that state to retry used to discard the count and the
  // bounded retry looped forever. The state only holds which URL is showing
  // the fallback; the ref survives the retry.
  const attemptsByUrl = useRef<Map<string, number>>(new Map());
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  // Attribute the cached file to this surface — what the storage card reports.
  useEffect(() => {
    if (category && settings.cacheEnabled) {
      coverCacheRegistry.tag(cover, category);
    }
  }, [cover, category, settings.cacheEnabled]);

  const showFallback = failedUrl === cover;

  // Self-heal transient failures (bounded — a dead URL stops retrying)
  useEffect(() => {
    if (failedUrl !== cover) return;
    if ((attemptsByUrl.current.get(cover) ?? 0) >= MAX_FAILURES) return;
    const timer = setTimeout(() => setFailedUrl(null), RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [failedUrl, cover]);

  return (
    <Image
      source={showFallback ? DEFAULT_COVER : { uri: cover }}
      style={[{ backgroundColor: THEME.COLORS.APP_BG }, style ?? styles.image]}
      placeholder={DEFAULT_COVER}
      placeholderContentFit="cover"
      onError={() => {
        attemptsByUrl.current.set(
          cover,
          (attemptsByUrl.current.get(cover) ?? 0) + 1,
        );
        setFailedUrl(cover);
      }}
      onLoad={() => {
        // The fallback (bundled asset) loads too and fires this — it must
        // NOT clear the failure state or it wipes the attempt counter and
        // the bounded retry loops forever on a dead URL.
        if (!showFallback) {
          attemptsByUrl.current.delete(cover);
          setFailedUrl(null);
        }
      }}
      cachePolicy={cachePolicy ?? (settings.cacheEnabled ? "disk" : "none")}
      contentFit="cover"
      recyclingKey={recyclingKey ?? cover}
    />
  );
}
