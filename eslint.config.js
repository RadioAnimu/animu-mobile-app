const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const sonarjs = require("eslint-plugin-sonarjs");

const RELATIVE_IMPORT_MESSAGE =
  "Use the @/ (src) or @app/ (project root) alias instead of a relative import.";

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
  "sonarjs/super-linear-regex", // false positive on a linear regex
  // Metrics that duplicate cognitive-complexity (kept as an error) without
  // measuring readability: a flat validation/switch function is cheap to read
  // but scores high; union size is a style count on string-literal unions.
  "sonarjs/cyclomatic-complexity",
  "sonarjs/max-union-size",
]);

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "android/*",
      "ios/*",
      "node_modules/*",
      // The Airwave submodule has its own ESLint config and CI.
      "packages/react-native-airwave/**",
    ],
    rules: {
      // Expo SDK 57's config enables the React Compiler lint rules, including
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
          patterns: [
            {
              group: ["./*", "./**", "../*", "../**"],
              message: RELATIVE_IMPORT_MESSAGE,
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
]);
