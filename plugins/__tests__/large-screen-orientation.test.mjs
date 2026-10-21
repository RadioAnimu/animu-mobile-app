import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it, expect } from "vitest";
const require = createRequire(import.meta.url);
const { removeScreenOrientation, addPhonePortraitLock } = require("../withAndroidLargeScreenOrientation.js");
const { XML } = require("expo/config-plugins");

// Body of onCreate from the Expo SDK 57 Kotlin MainActivity template
// (node_modules/expo/template.tgz -> MainActivity.kt).
const TEMPLATE_MAIN_ACTIVITY = `package com.helloworld

import android.os.Bundle

import com.facebook.react.ReactActivity

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

const MANIFEST_WITH_ORIENTATION = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:name=".MainApplication"><activity android:name=".MainActivity" android:screenOrientation="portrait" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|smallestScreenSize|screenLayout|uiMode" android:label="Animu" android:launchMode="singleTask" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>';

it("removes android:screenOrientation from the main activity and keeps its other attributes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "animu-orientation-"));
  try {
    const manifestPath = path.join(root, "AndroidManifest.xml");
    await writeFile(manifestPath, MANIFEST_WITH_ORIENTATION);
    const manifest = await XML.readXMLAsync({ path: manifestPath });
    removeScreenOrientation(manifest);
    const activity = manifest.manifest.application[0].activity[0];
    expect(activity.$["android:screenOrientation"]).toBeUndefined();
    expect(activity.$).toEqual({
      "android:name": ".MainActivity",
      "android:configChanges": "keyboard|keyboardHidden|orientation|screenSize|smallestScreenSize|screenLayout|uiMode",
      "android:label": "Animu",
      "android:launchMode": "singleTask",
      "android:exported": "true",
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("locks phones to portrait on create and on configuration changes, once, and throws without an anchor", () => {
  const once = addPhonePortraitLock(TEMPLATE_MAIN_ACTIVITY);
  expect(once).toContain("import android.content.pm.ActivityInfo\nimport android.content.res.Configuration\nimport android.os.Bundle");
  expect(once).toContain("override fun onCreate(savedInstanceState: Bundle?) {\n    applyOrientationLock()\n");
  expect(once.indexOf("applyOrientationLock()")).toBeLessThan(once.indexOf("super.onCreate(null)"));
  expect(once).toContain("    super.onConfigurationChanged(newConfig)\n    applyOrientationLock(newConfig)\n");
  expect(once).toContain(
    "      if (config.smallestScreenWidthDp >= 600) ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED\n" +
    "      else ActivityInfo.SCREEN_ORIENTATION_PORTRAIT\n",
  );
  expect(once.indexOf("private fun applyOrientationLock")).toBeLessThan(once.indexOf("override fun getMainComponentName"));
  expect(addPhonePortraitLock(once)).toBe(once);

  // A template change in a future Expo SDK should fail loudly, not silently skip.
  expect(() => addPhonePortraitLock(TEMPLATE_MAIN_ACTIVITY.replace("import android.os.Bundle", ""))).toThrow("import anchor");
  expect(() => addPhonePortraitLock(TEMPLATE_MAIN_ACTIVITY.replace("override fun onCreate", "override fun onResume"))).toThrow("onCreate");
  expect(() => addPhonePortraitLock(TEMPLATE_MAIN_ACTIVITY.replace("getMainComponentName", "mainComponent"))).toThrow("getMainComponentName");
});
