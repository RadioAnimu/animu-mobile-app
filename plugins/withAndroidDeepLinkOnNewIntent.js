const { withMainActivity } = require("@expo/config-plugins");

const IMPORT_LINE = "import android.content.Intent";
const IMPORTS_ANCHOR = "import android.os.Bundle";
const MARKER = "// @generated animu-deep-link-onnewintent";

/**
 * Android 16+ requires the activity to persist the current intent. Without it,
 * React Native's `Linking` (and `expo-web-browser`'s Android auth-session
 * polyfill — Android has no native `openAuthSessionAsync`, so it resolves the
 * OAuth redirect through `Linking` `url` events) sees the stale launch intent
 * and the redirect never arrives: the browser returns `dismiss`, `getInitialURL`
 * is wrong, and url listeners don't fire.
 *
 * See expo/expo#44284 — the fix is overriding `onNewIntent` and calling
 * `setIntent(intent)`.
 */
module.exports = function withAndroidDeepLinkOnNewIntent(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== "kt") {
      return config;
    }

    let contents = config.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(
        IMPORTS_ANCHOR,
        `${IMPORT_LINE}\n${IMPORTS_ANCHOR}`
      );
    }

    if (!contents.includes(MARKER)) {
      contents = contents.replace(
        /(\n\s*override fun getMainComponentName)/,
        `\n  ${MARKER}\n` +
          `  override fun onNewIntent(intent: Intent) {\n` +
          `    super.onNewIntent(intent)\n` +
          `    setIntent(intent)\n` +
          `  }\n$1`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
