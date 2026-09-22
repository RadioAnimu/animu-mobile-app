const fs = require("fs");
const path = require("path");

const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");

const SHORTCUTS_FILE = "shortcuts.xml";

/**
 * Google Assistant App Actions. `actions.intent.PLAY_MEDIA` is the built-in
 * intent for "play <something> on <app>", and it fulfils through the same
 * `animuapp://assistant/play` deep link Siri uses.
 *
 * Deployment reality (this is why "Hey Google" does nothing on a dev build):
 * App Actions are only recognised for apps published to Google Play and passed
 * review. Sideloaded/debug builds never match — the old App Actions Test Tool
 * that faked a preview has been removed from Android Studio. The `targetPackage`
 * / `targetClass` pair below makes the fulfillment target explicit so Assistant
 * does not have to resolve it from the URL scheme.
 */
function buildShortcutsXml(packageName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <capability android:name="actions.intent.PLAY_MEDIA">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity">
      <url-template android:value="animuapp://assistant/play" />
    </intent>
  </capability>
</shortcuts>
`;
}

/** Writes `res/xml/shortcuts.xml` into the generated Android project. */
function writeShortcuts(config) {
  const packageName = config.android?.package;
  if (!packageName) {
    throw new Error(
      "[withAndroidAppActions] android.package is required to write shortcuts.xml",
    );
  }

  const resXmlDir = path.join(
    config.modRequest.platformProjectRoot,
    "app/src/main/res/xml",
  );
  fs.mkdirSync(resXmlDir, { recursive: true });
  fs.writeFileSync(
    path.join(resXmlDir, SHORTCUTS_FILE),
    buildShortcutsXml(packageName),
  );
  return config;
}

/** Points the launcher activity at the shortcuts resource. */
function addManifestMetaData(config) {
  const manifest = config.modResults;
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);

  activity["meta-data"] = activity["meta-data"] ?? [];
  const alreadyPresent = activity["meta-data"].some(
    (entry) => entry.$["android:name"] === "android.app.shortcuts",
  );
  if (!alreadyPresent) {
    activity["meta-data"].push({
      $: {
        "android:name": "android.app.shortcuts",
        "android:resource": "@xml/shortcuts",
      },
    });
  }

  return config;
}

module.exports = function withAndroidAppActions(config) {
  config = withDangerousMod(config, ["android", writeShortcuts]);
  config = withAndroidManifest(config, addManifestMetaData);
  return config;
};

module.exports.buildShortcutsXml = buildShortcutsXml;
