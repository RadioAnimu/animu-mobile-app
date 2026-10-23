import { createRequire } from "node:module";
import { it, expect } from "vitest";
const require = createRequire(import.meta.url);
const { addTVSupport } = require("../withAndroidTV.js");

function manifest({ features } = {}) {
  return {
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      ...(features ? { "uses-feature": features } : {}),
      application: [
        {
          $: { "android:name": ".MainApplication" },
          activity: [
            {
              $: { "android:name": ".MainActivity" },
              "intent-filter": [
                { action: [{ $: { "android:name": "android.intent.action.VIEW" } }] },
                {
                  action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
                  category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

it("lists the main activity in the TV launcher, sets the banner and makes touch optional, once", () => {
  const result = addTVSupport(manifest());
  const app = result.manifest.application[0];
  const filters = app.activity[0]["intent-filter"];

  expect(app.$["android:banner"]).toBe("@drawable/tv_banner");
  expect(filters[1].category.map((c) => c.$["android:name"])).toEqual([
    "android.intent.category.LAUNCHER",
    "android.intent.category.LEANBACK_LAUNCHER",
  ]);
  // Only the MAIN filter is touched.
  expect(filters[0].category).toBeUndefined();
  expect(result.manifest["uses-feature"]).toEqual([
    { $: { "android:name": "android.software.leanback", "android:required": "false" } },
    { $: { "android:name": "android.hardware.touchscreen", "android:required": "false" } },
  ]);

  // Idempotent: a second pass adds nothing.
  addTVSupport(result);
  expect(filters[1].category).toHaveLength(2);
  expect(result.manifest["uses-feature"]).toHaveLength(2);
});

it("downgrades an existing required touchscreen feature instead of duplicating it", () => {
  const result = addTVSupport(
    manifest({ features: [{ $: { "android:name": "android.hardware.touchscreen", "android:required": "true" } }] }),
  );
  const touch = result.manifest["uses-feature"].filter(
    (f) => f.$["android:name"] === "android.hardware.touchscreen",
  );
  expect(touch).toEqual([{ $: { "android:name": "android.hardware.touchscreen", "android:required": "false" } }]);
});

it("fails loudly when the launcher intent-filter is missing", () => {
  const broken = manifest();
  broken.manifest.application[0].activity[0]["intent-filter"].pop();
  expect(() => addTVSupport(broken)).toThrow("MAIN intent-filter");
});
