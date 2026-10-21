const { AndroidConfig, withAndroidManifest, withMainActivity } = require("expo/config-plugins");

const IMPORT_LINES = ["import android.content.pm.ActivityInfo", "import android.content.res.Configuration"];
const IMPORTS_ANCHOR = "import android.os.Bundle";
const MARKER = "// @generated animu-phone-portrait-lock";

const ON_CREATE_ANCHOR = /(\n\s*override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)/;
const METHODS_ANCHOR = /(\n\s*override fun getMainComponentName)/;

const LOCK_METHODS =
  `  ${MARKER}\n` +
  "  override fun onConfigurationChanged(newConfig: Configuration) {\n" +
  "    super.onConfigurationChanged(newConfig)\n" +
  "    applyOrientationLock(newConfig)\n" +
  "  }\n\n" +
  "  private fun applyOrientationLock(config: Configuration = resources.configuration) {\n" +
  "    requestedOrientation =\n" +
  "      if (config.smallestScreenWidthDp >= 600) ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED\n" +
  "      else ActivityInfo.SCREEN_ORIENTATION_PORTRAIT\n" +
  "  }\n";

/**
 * Android 16 ignores screenOrientation and resize restrictions on large
 * screens (sw >= 600dp), so Play flags the manifest attribute. app.json keeps
 * {"orientation": "portrait"} for iOS, but the manifest must not declare it:
 * `removeScreenOrientation` strips it from the main activity and
 * `addPhonePortraitLock` reproduces the phone-only lock in code — phones stay
 * portrait while tablets and foldables may rotate and resize freely. The lock is
 * re-applied on configuration changes, since folding a foldable changes
 * smallestScreenWidthDp without recreating the activity.
 */
function removeScreenOrientation(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  delete activity.$["android:screenOrientation"];
}

function addPhonePortraitLock(contents) {
  if (contents.includes(MARKER)) return contents;
  if (!contents.includes(IMPORTS_ANCHOR)) {
    throw new Error("MainActivity.kt is missing the expected import anchor: " + IMPORTS_ANCHOR);
  }
  if (!ON_CREATE_ANCHOR.test(contents)) {
    throw new Error("MainActivity.kt is missing the expected onCreate(savedInstanceState: Bundle?) anchor");
  }
  if (!METHODS_ANCHOR.test(contents)) {
    throw new Error("MainActivity.kt is missing the expected getMainComponentName anchor");
  }
  const imports = IMPORT_LINES.filter((line) => !contents.includes(line));
  if (imports.length) contents = contents.replace(IMPORTS_ANCHOR, `${imports.join("\n")}\n${IMPORTS_ANCHOR}`);
  return contents
    .replace(ON_CREATE_ANCHOR, "$1    applyOrientationLock()\n")
    .replace(METHODS_ANCHOR, `\n${LOCK_METHODS}$1`);
}

module.exports = function withAndroidLargeScreenOrientation(config) {
  config = withAndroidManifest(config, (config) => {
    removeScreenOrientation(config.modResults);
    return config;
  });
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== "kt") {
      return config;
    }
    config.modResults.contents = addPhonePortraitLock(config.modResults.contents);
    return config;
  });
};
module.exports.removeScreenOrientation = removeScreenOrientation;
module.exports.addPhonePortraitLock = addPhonePortraitLock;
