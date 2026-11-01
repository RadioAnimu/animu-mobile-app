const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

/**
 * The app follows the window on every device — phones rotate, tablets and
 * foldables rotate and resize freely — so the
 * main activity must not declare a screen orientation at all. Android 16
 * ignores the attribute on large screens anyway (sw >= 600dp) and Play flags
 * it, so it is stripped rather than left as `unspecified`.
 *
 * The activity's `configChanges` already covers orientation, screen size and
 * layout, so a rotation or resize re-lays out the React tree in place: no
 * activity restart, no interruption of the player.
 */
function removeScreenOrientation(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  delete activity.$["android:screenOrientation"];
}

module.exports = function withAndroidLargeScreenOrientation(config) {
  return withAndroidManifest(config, (config) => {
    removeScreenOrientation(config.modResults);
    return config;
  });
};
module.exports.removeScreenOrientation = removeScreenOrientation;
