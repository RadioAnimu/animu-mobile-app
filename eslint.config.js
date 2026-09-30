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
]);

// Rules cleaned up across the codebase and now enforced as errors (regressions
// fail CI). Promote more here as the remaining warnings are worked down.
const SONARJS_ERROR = new Set([
  "sonarjs/array-constructor",
  "sonarjs/destructuring-assignment-syntax",
  "sonarjs/no-nested-incdec",
  "sonarjs/no-nested-template-literals",
  "sonarjs/no-undefined-assignment",
  "sonarjs/no-unused-function-argument",
  "sonarjs/redundant-type-aliases",
  "sonarjs/variable-name",
]);

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*", "node_modules/*"],
    rules: {
      // Expo SDK 57's config enables the React Compiler lint rules. The app
      // does not run the compiler, and the codebase intentionally uses
      // `useRef(new Animated.Value()).current` plus prop->state sync effects.
      // Turn these two off rather than rewriting animation/effect logic.
      "react-hooks/refs": "off",
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
    // are excluded: their style is not a maintainability signal). Most rules
    // are warnings so the remaining backlog surfaces without failing the build;
    // the rules in SONARJS_ERROR are enforced.
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
        SONARJS_DISABLED.has(rule)
          ? "off"
          : SONARJS_ERROR.has(rule)
            ? "error"
            : "warn",
      ]),
    ),
  },
]);
