import type { Platform } from "react-native";

/** Smallest width (px) of the shared PNG — the social-feed standard. */
const CAPTURE_MIN_WIDTH_PX = 1080;

/**
 * The `width`/`height` to hand view-shot for a card of `width × height`
 * points. The units differ per platform: Android scales the native bitmap
 * to that many *pixels*, iOS draws into a rect of that many *points* at
 * device scale. Either way the PNG comes out at least
 * CAPTURE_MIN_WIDTH_PX wide (never below the screen's own density), with
 * the card's aspect kept.
 */
export const captureSize = (
  width: number,
  height: number,
  pixelRatio: number,
  os: typeof Platform.OS,
): { width: number; height: number } => {
  const px = Math.max(CAPTURE_MIN_WIDTH_PX, width * pixelRatio);
  const outWidth = os === "ios" ? px / pixelRatio : px;
  return {
    width: Math.round(outWidth),
    height: Math.round((outWidth * height) / width),
  };
};
