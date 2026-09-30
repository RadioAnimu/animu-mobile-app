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
    // Jenkins' `junit` step picks up junit.xml; without a reporter it would
    // silently publish nothing.
    reporters: process.env.CI
      ? ["default", ["junit", { outputFile: "junit.xml" }]]
      : ["default"],
    coverage: {
      // `lcov` feeds SonarQube / Codecov / any lcov consumer; `text` prints the
      // summary to the CI log. Only app code counts (tests are excluded).
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/@types/**",
      ],
    },
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
