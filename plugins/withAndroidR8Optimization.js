const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

const DEFAULT_RULES = 'getDefaultProguardFile("proguard-android.txt")';
const OPTIMIZE_RULES = 'getDefaultProguardFile("proguard-android-optimize.txt")';
const RESOURCE_SHRINKING = "android.r8.optimizedResourceShrinking";

/**
 * Play vitals reads the R8 metadata in the bundle. Expo's template uses
 * `proguard-android.txt`, whose `-dontoptimize` turns R8 optimization off, and
 * AGP 8 leaves R8's optimized resource shrinking off until AGP 9.
 */
function enableR8Optimization(buildGradle) {
  if (buildGradle.includes(OPTIMIZE_RULES)) return buildGradle;
  if (!buildGradle.includes(DEFAULT_RULES)) {
    throw new Error("withAndroidR8Optimization: default ProGuard rules not found in app/build.gradle");
  }
  return buildGradle.replace(DEFAULT_RULES, OPTIMIZE_RULES);
}

function enableOptimizedResourceShrinking(properties) {
  const rest = properties.filter((item) => !(item.type === "property" && item.key === RESOURCE_SHRINKING));
  return [...rest, { type: "property", key: RESOURCE_SHRINKING, value: "true" }];
}

module.exports = (config) => {
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = enableR8Optimization(config.modResults.contents);
    return config;
  });
  return withGradleProperties(config, (config) => {
    config.modResults = enableOptimizedResourceShrinking(config.modResults);
    return config;
  });
};
module.exports.enableR8Optimization = enableR8Optimization;
module.exports.enableOptimizedResourceShrinking = enableOptimizedResourceShrinking;
