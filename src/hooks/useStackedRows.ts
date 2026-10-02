import { useWindowDimensions } from "react-native";

/**
 * OS text-size multiplier from which a row's trailing value moves under its
 * label — iOS's own layout switch at the accessibility sizes. Beside the
 * label, a value squeezes the label column until single words break.
 */
const STACK_FROM_FONT_SCALE = 1.5;

/** Whether rows should stack their trailing value under the label. */
export function useStackedRows(): boolean {
  return useWindowDimensions().fontScale >= STACK_FROM_FONT_SCALE;
}
