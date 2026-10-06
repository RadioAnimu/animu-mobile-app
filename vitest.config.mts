import { configDefaults, defineConfig } from "vitest/config";
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
    // The Airwave submodule has its own (Jest) suite: `pnpm check:player`.
    exclude: [...configDefaults.exclude, "packages/react-native-anything-player/**", "scripts/__tests__/**"],
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
      // Regression floor, set just under the measured totals (68.2 / 63.9 /
      // 58.0 / 69.0). Raise it as coverage grows; never lower it to pass.
      thresholds: {
        statements: 67,
        branches: 62,
        functions: 57,
        lines: 68,
      },
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
