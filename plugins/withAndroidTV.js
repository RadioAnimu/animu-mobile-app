const fs = require("node:fs/promises");
const path = require("node:path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const BANNER_SOURCE = "assets/tv-banner.png";
const BANNER_RESOURCE = "tv_banner";
const LEANBACK_LAUNCHER = "android.intent.category.LEANBACK_LAUNCHER";

/**
 * Optional on TV, so phones and tablets keep installing exactly as before:
 * Android TV has no touchscreen, and a manifest that implies one hides the
 * app from TV devices.
 */
const OPTIONAL_FEATURES = ["android.software.leanback", "android.hardware.touchscreen"];

/**
 * Makes the one APK launchable on Android TV / Google TV boxes:
 * - declares touch and leanback optional,
 * - gives the application its 320×180 home-screen banner,
 * - lists the main activity in the TV launcher (LEANBACK_LAUNCHER beside
 *   the phone LAUNCHER category on the same MAIN filter).
 * The UI itself is shared; D-pad focus and 10-foot sizing live in JS.
 */
function addTVSupport(manifest) {
  const root = manifest.manifest;
  root["uses-feature"] = root["uses-feature"] ?? [];
  for (const name of OPTIONAL_FEATURES) {
    const existing = root["uses-feature"].find((feature) => feature.$["android:name"] === name);
    if (existing) existing.$["android:required"] = "false";
    else root["uses-feature"].push({ $: { "android:name": name, "android:required": "false" } });
  }

  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.$["android:banner"] = `@drawable/${BANNER_RESOURCE}`;

  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const launcher = (activity["intent-filter"] ?? []).find((filter) =>
    (filter.action ?? []).some((action) => action.$["android:name"] === "android.intent.action.MAIN"),
  );
  if (!launcher) throw new Error("MainActivity has no MAIN intent-filter to add the TV launcher category to");
  launcher.category = launcher.category ?? [];
  if (!launcher.category.some((category) => category.$["android:name"] === LEANBACK_LAUNCHER)) {
    launcher.category.push({ $: { "android:name": LEANBACK_LAUNCHER } });
  }
  return manifest;
}

module.exports = function withAndroidTV(config) {
  config = withAndroidManifest(config, (config) => {
    addTVSupport(config.modResults);
    return config;
  });
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // The TV banner spec is 320×180 px in drawable-xhdpi.
      const folder = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/drawable-xhdpi");
      await fs.mkdir(folder, { recursive: true });
      await fs.copyFile(
        path.join(config.modRequest.projectRoot, BANNER_SOURCE),
        path.join(folder, `${BANNER_RESOURCE}.png`),
      );
      return config;
    },
  ]);
};
module.exports.addTVSupport = addTVSupport;
