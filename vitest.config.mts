import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // `@/*` -> `src/*`, `@app/*` -> project root. The regex form keeps scoped
    // packages like `@react-native-vector-icons/*` from being rewritten.
    alias: [
      { find: /^@\//, replacement: `${srcDir}/` },
      { find: /^@app\//, replacement: `${rootDir}/` },
    ],
  },
});
