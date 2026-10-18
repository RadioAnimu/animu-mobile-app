import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { THEME } from "@/theme";

/** Themed chrome shared by every in-app browser session. */
const BROWSER_OPTIONS: Parameters<typeof WebBrowser.openBrowserAsync>[1] = {
  toolbarColor: THEME.COLORS.BG_DEEP,
  controlsColor: THEME.COLORS.BRAND,
  secondaryToolbarColor: THEME.COLORS.SURFACE,
  showTitle: true,
  enableBarCollapsing: true,
};

/** True while a session is up: a second tap waits out instead of stacking sheets. */
let sessionOpen = false;

/**
 * iOS rejects opening over a presented session (including an OAuth one) with
 * expo-web-browser's `WebBrowserAlreadyOpenException` — never send that to Safari.
 */
function isSessionOpenError(error: unknown): boolean {
  return (
    (error as { code?: unknown } | null)?.code === "ERR_WEB_BROWSER_ALREADY_OPEN"
  );
}

/**
 * Open a read-and-return page in the in-app browser (SFSafariViewController
 * on iOS, Custom Tabs on Android) so the user stays inside the app.
 *
 * If the platform can't show one, the system browser takes the URL instead.
 * On iOS this resolves once the sheet is dismissed (Android: once the tab has
 * launched); a second tap meanwhile is a no-op, so a double tap never queues
 * a second sheet (or a Safari window).
 */
export async function openInAppBrowser(url: string): Promise<void> {
  if (sessionOpen) return;
  sessionOpen = true;
  try {
    try {
      await WebBrowser.openBrowserAsync(url, BROWSER_OPTIONS);
    } catch (error) {
      if (isSessionOpenError(error)) return;
      await Linking.openURL(url);
    }
  } finally {
    sessionOpen = false;
  }
}

/**
 * Open a URL outside the app: links that belong in a native app or the
 * system browser (logged-in social timelines, the Discord invite).
 */
export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(url);
}
