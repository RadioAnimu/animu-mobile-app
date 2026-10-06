const fs = require("node:fs/promises");
const path = require("node:path");
const { AndroidConfig, XML, withFinalizedMod } = require("@expo/config-plugins");

const SPLASH_THEME = "Theme.App.SplashScreen";
const SPLASH_BEHAVIOR = "android:windowSplashScreenBehavior";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function fixReleaseResources(androidRoot) {
  const res = path.join(androidRoot, "app/src/main/res");
  const basePath = path.join(res, "values/styles.xml");
  const base = await AndroidConfig.Resources.readResourcesXMLAsync({ path: basePath });
  const splash = base.resources.style?.find((style) => style.$.name === SPLASH_THEME);
  const api33 = splash?.item?.filter((item) => item.$.name === SPLASH_BEHAVIOR) ?? [];
  if (api33.length) {
    // A qualified style is a complete replacement, so preserve its base items
    // and parent rather than creating a partial style on Android 13+.
    const qualifiedPath = path.join(res, "values-v33/styles.xml");
    const qualified = await AndroidConfig.Resources.readResourcesXMLAsync({ path: qualifiedPath });
    qualified.resources.style = (qualified.resources.style ?? []).filter(
      (style) => style.$.name !== SPLASH_THEME,
    );
    qualified.resources.style.push(structuredClone(splash));
    splash.item = splash.item.filter((item) => item.$.name !== SPLASH_BEHAVIOR);
    await fs.mkdir(path.dirname(qualifiedPath), { recursive: true });
    await XML.writeXMLAsync({ path: qualifiedPath, xml: qualified });
    await XML.writeXMLAsync({ path: basePath, xml: base });
  }

  // Expo SDK 57 writes PNG buffers under .webp names. Keep the bytes and
  // resource IDs unchanged; correct only confirmed PNG launcher resources.
  for (const entry of await fs.readdir(res, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("mipmap-")) continue;
    const folder = path.join(res, entry.name);
    for (const file of await fs.readdir(folder)) {
      if (!/^ic_launcher(?:_round|_foreground|_background|_monochrome)?\.webp$/.test(file)) continue;
      const from = path.join(folder, file);
      const bytes = await fs.readFile(from);
      if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        await fs.rename(from, from.replace(/\.webp$/, ".png"));
      }
    }
  }

  const manifestPath = path.join(androidRoot, "app/src/main/AndroidManifest.xml");
  const manifest = await XML.readXMLAsync({ path: manifestPath });
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  // The app only adds its own stats-card image, never reads shared media.
  delete app.$["android:requestLegacyExternalStorage"];
  for (const permission of manifest.manifest["uses-permission"] ?? []) {
    if (permission.$["android:name"] === "android.permission.WRITE_EXTERNAL_STORAGE") {
      permission.$["android:maxSdkVersion"] = "28";
    }
  }
  await XML.writeXMLAsync({ path: manifestPath, xml: manifest });
}

module.exports = (config) => withFinalizedMod(config, ["android", async (result) => {
  await fixReleaseResources(result.modRequest.platformProjectRoot);
  return result;
}]);
module.exports.fixReleaseResources = fixReleaseResources;
