import { Dimensions, Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import type { AppRouteName } from "@/routes/app.routes";

/**
 * Where a phone may turn to landscape: the player — Home and its lyrics — as
 * Apple Music's player does on iOS 27. Lists, settings and forms stay in
 * portrait, as in Apple Music, Spotify and YouTube Music on phones.
 */
const LANDSCAPE_ROUTES: ReadonlySet<string> = new Set<AppRouteName>(["Home", "Lyrics"]);

/** A screen whose short side is this wide (pt/dp) or more is a tablet's. */
const TABLET_MIN_SHORT_SIDE = 600;

/**
 * A phone: a handheld screen narrower than a tablet's. Tablets (iPads,
 * Android tablets, an unfolded foldable) and TVs turn freely everywhere —
 * iPadOS ignores app locks in resizable windows anyway.
 */
export function isPhone(): boolean {
  if (Platform.isTV || (Platform.OS === "ios" && Platform.isPad)) return false;
  const { width, height } = Dimensions.get("screen");
  return Math.min(width, height) < TABLET_MIN_SHORT_SIDE;
}

/** Portrait only on a phone away from the player; otherwise free. */
export function locksPortrait(route: string | undefined, phone: boolean): boolean {
  return phone && route !== undefined && !LANDSCAPE_ROUTES.has(route);
}

let applied: boolean | null = null;

/**
 * Applies the policy for the focused route. A screen that locks to portrait
 * while the phone lies sideways turns the app upright; coming back to the
 * player frees it again.
 */
export function applyOrientationPolicy(route: string | undefined): void {
  const portrait = locksPortrait(route, isPhone());
  if (portrait === applied) return;
  applied = portrait;
  const change = portrait
    ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
    : ScreenOrientation.unlockAsync();
  change.catch((error: unknown) => {
    applied = null;
    console.warn("[orientation] policy not applied:", error);
  });
}
