const fs = require("node:fs");
const path = require("node:path");
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const sonarjs = require("eslint-plugin-sonarjs");
const globals = require("globals");

const RELATIVE_IMPORT_MESSAGE =
  "Use the @/ (src) or @app/ (project root) alias instead of a relative import.";
const RELATIVE_IMPORT_PATTERN = {
  group: ["./*", "./**", "../*", "../**"],
  message: RELATIVE_IMPORT_MESSAGE,
};

/**
 * An architecture rule: production files in `files` may not import the
 * `forbidden` src layers. Imports are alias-only (see below), so matching
 * `@/<layer>` covers every path. Uses the TypeScript rule so it stacks with
 * the base `no-restricted-imports` instead of replacing it.
 */
const layerRule = (files, forbidden, message, options = {}) => ({
  files,
  ignores: ["src/**/__tests__/**"],
  rules: {
    "@typescript-eslint/no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: forbidden.flatMap((layer) => [`@/${layer}`, `@/${layer}/**`]),
            message,
            ...options,
          },
        ],
      },
    ],
  },
});

// SonarJS rules that are noise for this codebase, or that mis-flag
// React/React-Native idioms.
const SONARJS_DISABLED = new Set([
  // Pure style / noise.
  "sonarjs/file-header",
  "sonarjs/arrow-function-convention",
  "sonarjs/no-duplicate-string",
  "sonarjs/shorthand-property-grouping",
  "sonarjs/no-implicit-dependencies", // pnpm-workspace/alias false-positive storm
  // Framework idioms these rules get wrong:
  "sonarjs/function-name", // React components are PascalCase by convention
  "sonarjs/no-wildcard-import", // `import * as React` / `import * as Notifications`
  "sonarjs/no-require-or-define", // Metro resolves assets via require()
  "sonarjs/no-inverted-boolean-check", // intentional `!(a > b)` NaN guards
  "sonarjs/no-reference-error", // type-only React/NodeJS references
  // Metrics that duplicate cognitive-complexity (kept as an error) without
  // measuring readability: a flat validation/switch function is cheap to read
  // but scores high; union size is a style count on string-literal unions.
  "sonarjs/cyclomatic-complexity",
  "sonarjs/max-union-size",
]);

module.exports = defineConfig([
  { ignores: ["packages/**", "dist/**"] },
  expoConfig,
  // eslint-config-expo asks eslint-plugin-react to detect the React version,
  // which calls context.getFilename(), removed in ESLint 10. Keep in step with
  // the installed react.
  { settings: { react: { version: "19.3" } } },
  {
    ignores: [
      "dist/*",
      "android/*",
      "ios/*",
      "node_modules/*",
    ],
    rules: {
      // Expo SDK 58's config enables the React Compiler lint rules, including
      // `react-hooks/refs` (kept on). `set-state-in-effect` is off: the app
      // does not run the compiler, and its remaining hits are effects that
      // sync state with an external system (disk/artwork cache, keyboard and
      // fetch lifecycles) where a synchronous reset is the intended behavior.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // App code must import through the aliases (see tsconfig.json paths), not
    // relative paths. Scoped to app entry points so Node-loaded tooling
    // (babel/metro/eslint configs, scripts) can keep using relative requires.
    files: ["src/**/*.{ts,tsx}", "App.tsx", "index.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [RELATIVE_IMPORT_PATTERN],
          paths: [
            {
              name: "react-native",
              importNames: ["AppState"],
              message: "Read app state through AppStateProvider (useIsBackgrounded).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='require'] > Literal[value=/^\\.\\.?\\//]",
          message: RELATIVE_IMPORT_MESSAGE,
        },
      ],
    },
  },
  {
    // The one AppState listener, and Routes: its tree is frozen while hidden
    // (AppStateGate), so it needs the native event (see src/routes/index.tsx).
    files: ["src/contexts/app-state/AppStateProvider.tsx", "src/routes/index.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [RELATIVE_IMPORT_PATTERN] }],
    },
  },
  // ── Architecture: which layer may import which (fails lint, like a test) ──
  layerRule(
    ["src/core/**", "src/api/**"],
    ["i18n", "theme", "components", "contexts", "hooks", "screens", "routes"],
    "Core and API stay UI-free: map to copy, styles and React in the UI layer.",
  ),
  layerRule(
    ["src/theme/**"],
    ["core", "api", "i18n", "utils", "constants", "components", "contexts", "hooks", "screens", "routes"],
    "Theme is a leaf: design tokens import nothing from the app.",
  ),
  layerRule(
    ["src/utils/**", "src/constants/**"],
    ["components", "contexts", "hooks", "screens", "routes"],
    "Core imports utils and constants: no React layers here (type imports are fine).",
    { allowTypeImports: true },
  ),
  layerRule(
    ["src/components/**", "src/hooks/**"],
    ["screens"],
    "Shared UI must not depend on a screen: move the shared piece down.",
    { allowTypeImports: true },
  ),
  layerRule(
    ["src/contexts/**"],
    ["screens", "routes"],
    "Providers sit above the screens: take the screen as a prop (see PlayerProvider's fallback).",
    { allowTypeImports: true },
  ),
  // Each screen stands alone: what two screens share lives in components/ or utils/.
  ...fs
    .readdirSync(path.join(__dirname, "src/screens"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => ({
      files: [`src/screens/${name}/**`],
      ignores: ["src/**/__tests__/**"],
      rules: {
        "@typescript-eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/screens/*", `!@/screens/${name}`, `!@/screens/${name}/**`],
                message: "A screen must not import another screen: move the shared piece to components/ or utils/.",
              },
            ],
          },
        ],
      },
    })),
  {
    // SonarJS — the same rule family SonarQube's "Code Smells" come from, run
    // locally and in CI with no server. Applied to production code only (tests
    // are excluded: their style is not a maintainability signal). Every rule
    // not listed in SONARJS_DISABLED is an error, so regressions fail CI.
    files: ["src/**/*.{ts,tsx}", "App.tsx", "index.js"],
    ignores: [
      "src/**/__tests__/**",
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
    ],
    ...sonarjs.configs.recommended,
    rules: Object.fromEntries(
      Object.entries(sonarjs.configs.recommended.rules).map(([rule]) => [
        rule,
        SONARJS_DISABLED.has(rule) ? "off" : "error",
      ]),
    ),
  },
  {
    // Build-time code run by Node: config plugins, CI/tooling scripts and
    // tool configs. Expo's env-var rule protects EXPO_PUBLIC_* inlining in
    // the app bundle, which does not apply to scripts reading their own env.
    files: ["plugins/**/*.{js,mjs}", "scripts/**/*.{js,mjs,cjs}", "*.config.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
    rules: { "expo/no-env-var-destructuring": "off" },
  },
]);
