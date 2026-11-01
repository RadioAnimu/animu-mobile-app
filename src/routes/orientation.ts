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
 * Android tablets, an unfolded foldable) turn freely everywhere —
 * iPadOS ignores app locks in resizable windows anyway.
 */
export function isPhone(): boolean {
  if (Platform.OS === "ios" && Platform.isPad) return false;
  const { width, height } = Dimensions.get("screen");
  return Math.min(width, height) < TABLET_MIN_SHORT_SIDE;
}

/** Portrait only on a phone away from the player; otherwise free. */
export function locksPortrait(route: string | undefined, phone: boolean): boolean {
  return phone && route !== undefined && !LANDSCAPE_ROUTES.has(route);
}

let applied: boolean | null = null;
/** The route the policy follows: the latest one reported. */
let route: string | undefined;
/** The orientation calls, one at a time, in order. */
let queue: Promise<void> = Promise.resolve();
/** After a failed call (a transition still running), one more try. */
const RETRY_MS = 500;

/** Brings the native lock in line with the latest route and screen. */
async function settle(retry: boolean): Promise<void> {
  const portrait = locksPortrait(route, isPhone());
  if (portrait === applied) return;
  try {
    await (portrait
      ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      : ScreenOrientation.unlockAsync());
    applied = portrait;
  } catch (error) {
    applied = null;
    if (retry) {
      setTimeout(() => enqueue(false), RETRY_MS);
    } else {
      console.warn("[orientation] policy not applied:", error);
    }
  }
}

function enqueue(retry: boolean): void {
  queue = queue.then(() => settle(retry));
}

/**
 * Applies the policy for the focused route. A screen that locks to portrait
 * while the phone lies sideways turns the app upright; coming back to the
 * player frees it again — within the system's own rotation lock, which an
 * app should not override. Calls run one at a time and each reads the
 * latest route, so a burst of navigation ends on the right lock.
 */
export function applyOrientationPolicy(next: string | undefined): void {
  route = next;
  enqueue(true);
}

/**
 * Re-checks the policy for the current route: the screen changed size (a
 * foldable folding or unfolding crosses the phone / tablet line) or the app
 * came back to the foreground.
 */
export function refreshOrientationPolicy(): void {
  applied = null;
  enqueue(true);
}
