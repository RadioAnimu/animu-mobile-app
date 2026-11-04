import * as SplashScreen from "expo-splash-screen";

let hidden = false;

/**
 * Dismisses the native splash exactly once. Safe to call from any number of
 * places (splash image load, player initialized, timeout fallback) — later
 * calls are no-ops.
 */
export function hideSplashOnce() {
  if (hidden) return;
  hidden = true;
  SplashScreen.hide();
}
