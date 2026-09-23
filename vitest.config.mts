import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // Module-level `vi.fn()`s are shared across tests in a file; without this,
  // call-count assertions depend on execution order (a passing test can break
  // when another test is added before it). Clears calls between tests only —
  // implementations stay intact.
  test: {
    clearMocks: true,
  },
  resolve: {
    // `@/*` -> `src/*`, `@app/*` -> project root. The regex form keeps scoped
    // packages like `@react-native-vector-icons/*` from being rewritten.
    alias: [
      { find: /^@\//, replacement: `${srcDir}/` },
      { find: /^@app\//, replacement: `${rootDir}/` },
    ],
  },
});
