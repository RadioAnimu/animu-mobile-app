import { createRequire } from "node:module";
import { it, expect } from "vitest";
const require = createRequire(import.meta.url);
const { addFocusRing } = require("../withAndroidFocusRing.js");

// The onCreate body as Expo SDK 57 prebuild leaves it (splash screen registered first).
const MAIN_ACTIVITY = `package com.nessjs.animu
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

it("installs the D-pad focus ring after onCreate, once, and throws without an anchor", () => {
  const once = addFocusRing(MAIN_ACTIVITY);
  expect(once).toContain("import android.webkit.WebView\nimport android.widget.EditText\nimport kotlin.math.abs\nimport android.os.Bundle");
  // Focus the WebView took by mounting (not by a key) goes back where it was.
  expect(once).toContain("override fun dispatchKeyEvent(event: KeyEvent): Boolean {");
  // Only arrow keys count as heading somewhere (Select starts playback).
  expect(once).toContain("event.keyCode in ARROW_KEYS");
  expect(once).toContain("if (SystemClock.uptimeMillis() - lastArrowDownAt > KEY_FOCUS_WINDOW_MS) {\n      webView.post { from.requestFocus() }");
  expect(once).toContain("    super.onCreate(null)\n    installFocusRing()\n");
  expect(once.indexOf("private fun installFocusRing")).toBeLessThan(once.indexOf("override fun getMainComponentName"));
  // Never on touch, never on text fields, and the view's own foreground comes back.
  expect(once).toContain("if (focused == null || focused.isInTouchMode) return");
  // Leaving touch mode rings the control that already holds focus.
  expect(once).toContain("if (inTouchMode) clearFocusRing() else showFocusRing(currentFocus, null)");
  // ...and so does the window coming back in front (a dialog closing).
  expect(once).toContain("if (hasFocus) showFocusRing(currentFocus, null)");
  expect(once).toContain("} else if (focused !is EditText) {");
  // The decorative oscilloscope WebView is skipped, never ringed.
  expect(once).toContain("skipDecorativeWebView(webView, previous)");
  expect(once).toContain("webView.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS");
  // With nowhere to continue from, focus is released rather than stranded in the page.
  expect(once).toContain("webView.post { webView.findFocus()?.clearFocus() ?: webView.clearFocus() }");
  expect(once).toContain("focusRingView?.foreground = focusRingPrevious");
  expect(addFocusRing(once)).toBe(once);

  expect(() => addFocusRing(MAIN_ACTIVITY.replace("import android.os.Bundle", ""))).toThrow("import anchor");
  expect(() => addFocusRing(MAIN_ACTIVITY.replace("super.onCreate(null)", "super.onStart()"))).toThrow("onCreate");
  expect(() => addFocusRing(MAIN_ACTIVITY.replace("getMainComponentName", "mainComponent"))).toThrow("getMainComponentName");
});
