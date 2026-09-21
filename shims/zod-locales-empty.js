// Intentionally empty module.
//
// zod v4 re-exports every one of its locale tables through
// `zod/v4/locales/index.js` via `export * as locales` in both
// `zod/v4/core/index.js` and `zod/v4/classic/external.js`. Metro cannot
// tree-shake a namespace re-export, so all ~45 locale files (≈280 KB of
// the JS bundle) were shipped even though the app only ever uses the
// default English locale that `zod/v4/classic/schemas.js` registers
// directly from `../locales/en.js`.
//
// `metro.config.js` aliases that barrel to this file. Nothing imports
// `z.locales`, so the namespace is never read.
module.exports = {};
