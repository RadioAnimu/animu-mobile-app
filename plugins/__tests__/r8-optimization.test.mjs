import { createRequire } from "node:module";
import { it, expect } from "vitest";
const require = createRequire(import.meta.url);
const { enableR8Optimization, enableOptimizedResourceShrinking } = require("../withAndroidR8Optimization.js");

it("switches release builds to the optimizing ProGuard defaults, repeatedly", () => {
  const gradle = 'release {\n  proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"\n}';
  const once = enableR8Optimization(gradle);
  expect(once).toContain('getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"');
  expect(once).not.toContain('"proguard-android.txt"');
  expect(enableR8Optimization(once)).toBe(once);
  expect(() => enableR8Optimization("release {}")).toThrow(/ProGuard rules not found/);
});

it("enables R8 optimized resource shrinking once", () => {
  const props = [
    { type: "comment", value: "shrink" },
    { type: "property", key: "android.r8.optimizedResourceShrinking", value: "false" },
    { type: "property", key: "hermesEnabled", value: "true" },
  ];
  const once = enableOptimizedResourceShrinking(props);
  expect(once.filter((item) => item.key === "android.r8.optimizedResourceShrinking")).toEqual([
    { type: "property", key: "android.r8.optimizedResourceShrinking", value: "true" },
  ]);
  expect(once).toContainEqual({ type: "property", key: "hermesEnabled", value: "true" });
  expect(enableOptimizedResourceShrinking(once)).toEqual(once);
});
