const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

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
]);
