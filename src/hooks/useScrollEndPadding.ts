import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THEME } from "@/theme";

/**
 * Bottom padding for a full-height scroll view that runs edge-to-edge under
 * the home indicator / Android navigation bar: the live system inset plus one
 * content gap, so the last row clears the system UI when scrolled to the end
 * while the content still scrolls *under* it (no hard clip line above the
 * home indicator, no stacked safe-area + padding + extra gap).
 */
export function useScrollEndPadding(gap: number = THEME.SPACE.XXL): number {
  return useSafeAreaInsets().bottom + gap;
}
