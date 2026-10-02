import { RefreshControl, type RefreshControlProps } from "react-native";

import { THEME } from "@/theme";

/**
 * Color props are owned here. The rest is forwarded: on Android the scroll
 * view clones its `refreshControl` with `style` and itself as the child.
 */
type Props = Omit<
  RefreshControlProps,
  "tintColor" | "colors" | "progressBackgroundColor"
>;

/**
 * The one pull-to-refresh indicator: the platform control (UIRefreshControl /
 * SwipeRefreshLayout, so the pull threshold and physics stay native) tinted
 * with the brand on every screen — on Android a brand arrow on the surface
 * disc, on iOS a brand spinner over the content.
 */
export function AppRefreshControl(props: Props) {
  return (
    <RefreshControl
      {...props}
      tintColor={THEME.COLORS.BRAND}
      colors={[THEME.COLORS.BRAND]}
      progressBackgroundColor={THEME.COLORS.SURFACE}
    />
  );
}
