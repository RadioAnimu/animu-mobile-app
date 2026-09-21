// Learn more: https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const ZOD_LOCALES_SHIM = path.resolve(__dirname, "shims/zod-locales-empty.js");

// zod v4's `core/index` and `classic/external` both do
// `export * as locales from "../locales/index.js"`. Metro cannot
// tree-shake that namespace re-export, so every locale table ends up in
// the bundle even though the app only uses the default English locale
// (registered directly from `../locales/en.js`). Alias the all-locales
// barrel to an empty module. See shims/zod-locales-empty.js.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    /^\.\.\/locales\/index\.(c?js)$/.test(moduleName) &&
    /[\\/]node_modules[\\/]zod[\\/]v4[\\/](core|classic|mini)[\\/]/.test(
      context.originModulePath,
    )
  ) {
    return { type: "sourceFile", filePath: ZOD_LOCALES_SHIM };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
