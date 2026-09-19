const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

const RELATIVE_IMPORT_MESSAGE =
  "Use the @/ (src) or @app/ (project root) alias instead of a relative import.";

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
]);
