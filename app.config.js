// The config is app.json; this only adjusts the web export (`pnpm build:web`).
// `WEB_RELATIVE_PATHS` makes the export's script, font and image URLs relative
// (`./_expo/…`), so the folder works from any path it is unzipped to. Native
// builds and the dev server keep absolute paths.
module.exports = ({ config }) =>
  process.env.WEB_RELATIVE_PATHS
    ? { ...config, experiments: { ...config.experiments, baseUrl: "." } }
    : config;
