import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const viewFilters = require("../withIOSViewFilters.js");

const APP_DELEGATE = `class AppDelegate: ExpoAppDelegate {
  public override func application() -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    return true
  }
}
`;

describe("withIOSViewFilters AppDelegate", () => {
  it("applies the flags right after the factory is created", () => {
    const patched = viewFilters.addApplyCall(APP_DELEGATE);

    expect(patched).toContain(
      "    let factory = ExpoReactNativeFactory(delegate: delegate)\n    AnimuFeatureFlags.apply()\n",
    );
  });

  it("is idempotent across repeated prebuilds", () => {
    const once = viewFilters.addApplyCall(APP_DELEGATE);

    expect(viewFilters.addApplyCall(once)).toBe(once);
  });

  it("fails loudly when the template no longer creates the factory there", () => {
    expect(() => viewFilters.addApplyCall("class AppDelegate {}")).toThrow(/ExpoReactNativeFactory/);
  });
});

describe("withIOSViewFilters bridging header", () => {
  it("exposes the class to Swift once", () => {
    const header = viewFilters.addBridgingImport("// Bridging header\n");

    expect(header).toContain('#import "AnimuFeatureFlags.h"');
    expect(viewFilters.addBridgingImport(header)).toBe(header);
  });
});

describe("withIOSViewFilters provider", () => {
  it("only adds SwiftUI-backed filters on top of the stable flags", () => {
    const source = viewFilters.IMPLEMENTATION_SOURCE;

    expect(source).toContain("public ReactNativeFeatureFlagsOverridesOSSStable");
    expect(source).toContain("bool enableSwiftUIBasedFilters() override");
    expect(source.match(/override\s*\n?\s*\{/g)).toHaveLength(1);
  });
});
