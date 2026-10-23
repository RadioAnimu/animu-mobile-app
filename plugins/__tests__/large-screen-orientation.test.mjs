import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it, expect } from "vitest";
const require = createRequire(import.meta.url);
const { removeScreenOrientation } = require("../withAndroidLargeScreenOrientation.js");
const { XML } = require("expo/config-plugins");

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
