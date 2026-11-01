import { useEffect, useState } from "react";
import { Image, type ImageStyle } from "expo-image";
import { View, type StyleProp } from "react-native";
import DEFAULT_COVER from "@/assets/default-cover.png";
import { SIZE, styles } from "@/components/Cover/styles";
import { THEME } from "@/theme";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useBoundedRetry } from "@/hooks/useBoundedRetry";
import {
  coverCacheRegistry,
  type CoverCacheCategory,
} from "@/core/services/cover-cache-registry.service";

// Wider artwork is cropped to this rather than shown as a thin strip. Tall
// artwork has no cap: it just grows the frame.
const MAX_RATIO = 2;

/** Full slot width; the height follows the proportions. */
function fitInSlot(ratio: number) {
  return { width: SIZE, height: SIZE / Math.min(ratio, MAX_RATIO) };
}

/**
 * Inside a bounded frame nothing may outgrow the square: wide art fills the
 * width (cropped at `MAX_RATIO`), tall art fills the height and narrows.
 */
function fitInFrame(ratio: number, size: number) {
  return ratio >= 1
    ? { width: size, height: size / Math.min(ratio, MAX_RATIO) }
    : { width: size * ratio, height: size };
}

interface Props {
  cover: string;
  /** Overrides the default (now-playing) frame — e.g. list rows. */
  style?: StyleProp<ImageStyle>;
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
  /**
   * Shows the artwork in its real proportions instead of cropping it to the
   * square. The width is always the frame's; the height follows the image.
   * It is centered in a slot at least as tall as the square, so short art
   * leaves the layout where it was and tall art grows it. The frame is
   * square until the image reports its size.
   */
  preserveAspectRatio?: boolean;
  /**
   * Bounds the cover to a square frame of this side instead of the default
   * (`SIZE`). Where the player has a measured amount of room (the split
   * layout) tall art is contained in it rather than growing the slot.
   */
  size?: number;
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
export function Cover({
  cover,
  style,
  recyclingKey,
  category,
  preserveAspectRatio,
  size,
}: Readonly<Props>) {
  const { settings } = useUserSettings();
  // A failed load shows the bundled cover, then retries the URL (bounded — a
  // dead URL stops retrying).
  const { failed: showFallback, fail } = useBoundedRetry(cover);
  // Tied to the URL, so a new cover never renders one frame with the
  // previous artwork's proportions.
  const [measured, setMeasured] = useState<{ url: string; ratio: number } | null>(
    null,
  );

  // Attribute the cached file to this surface — what the storage card reports.
  useEffect(() => {
    if (category && settings.cacheEnabled) {
      coverCacheRegistry.tag(cover, category);
    }
  }, [cover, category, settings.cacheEnabled]);

  const ratio =
    preserveAspectRatio && !showFallback && measured?.url === cover
      ? measured.ratio
      : 1;

  const image = (
    <Image
      source={showFallback ? DEFAULT_COVER : { uri: cover }}
      style={[
        { backgroundColor: THEME.COLORS.APP_BG },
        style ?? styles.image,
        size !== undefined && { width: size, height: size },
        preserveAspectRatio &&
          (size === undefined ? fitInSlot(ratio) : fitInFrame(ratio, size)),
      ]}
      placeholder={DEFAULT_COVER}
      placeholderContentFit="cover"
      onError={fail}
      onLoad={(event) => {
        // The fallback (bundled asset) loads too and fires this: only the
        // artwork's own proportions count.
        if (!showFallback) {
          const { width, height } = event.source;
          if (preserveAspectRatio && width > 0 && height > 0) {
            setMeasured({ url: cover, ratio: width / height });
          }
        }
      }}
      cachePolicy={settings.cacheEnabled ? "disk" : "none"}
      contentFit="cover"
      recyclingKey={recyclingKey ?? cover}
    />
  );

  if (!preserveAspectRatio) return image;
  return (
    <View style={size === undefined ? styles.slot : [styles.slot, boundedSlot(size)]}>
      {image}
    </View>
  );
}

/** A slot held to exactly `size` square — tall art cannot grow it. */
function boundedSlot(size: number) {
  return { width: size, height: size, minHeight: 0 };
}

/**
 * The now-playing frame before there is anything to show (cold start): the
 * bundled cover in the same square slot, so the player doesn't open with a
 * gap that the first artwork then shoves everything down to fill.
 */
export function CoverPlaceholder({ size }: Readonly<{ size?: number }>) {
  return (
    <View style={size === undefined ? styles.slot : [styles.slot, boundedSlot(size)]}>
      <Image
        source={DEFAULT_COVER}
        style={[
          { backgroundColor: THEME.COLORS.APP_BG },
          styles.image,
          size !== undefined && { width: size, height: size },
        ]}
        contentFit="cover"
      />
    </View>
  );
}
