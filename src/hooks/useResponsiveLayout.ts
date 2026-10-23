import { useMemo } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveLayout, type ResponsiveLayout } from "@/theme/layout";

/**
 * Whether the app runs in an iPadOS window smaller than the screen (Stage
 * Manager / iPadOS 26 windowing), where the system draws window controls
 * over the top-leading corner. Compared side for side, so a rotation that
 * swaps both is still full screen.
 */
function isIPadWindowed(width: number, height: number): boolean {
  if (Platform.OS !== "ios" || !Platform.isPad) return false;
  const screen = Dimensions.get("screen");
  const short = Math.min(width, height) < Math.min(screen.width, screen.height) - 1;
  const long = Math.max(width, height) < Math.max(screen.width, screen.height) - 1;
  return short || long;
}

/**
 * The live window's layout (see `@/theme/layout`). Re-renders only when the
 * window size or its safe areas change, and hands back the same object until
 * they do, so it is safe to pass down or depend on in memoized children.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const { top, right, bottom, left } = useSafeAreaInsets();
  return useMemo(
    () =>
      resolveLayout(
        width,
        height,
        { top, right, bottom, left },
        Platform.isTV,
        isIPadWindowed(width, height),
      ),
    [width, height, top, right, bottom, left],
  );
}
