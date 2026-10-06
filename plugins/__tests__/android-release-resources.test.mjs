import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { it, expect } from "vitest";
const require = createRequire(import.meta.url);
const { fixReleaseResources } = require("../withAndroidReleaseResources.js");
const { XML } = require("@expo/config-plugins");

it("keeps complete splash styling on both SDK ranges and corrects only PNG icons, repeatedly", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "animu-resources-"));
  const res = path.join(root, "app/src/main/res");
  try {
    await mkdir(path.join(res, "values"), { recursive: true });
    await mkdir(path.join(res, "values-v33"));
    await mkdir(path.join(res, "mipmap-hdpi"));
    await writeFile(path.join(res, "values/styles.xml"), '<resources><style name="AppTheme"><item name="colorAccent">purple</item></style><style name="Theme.App.SplashScreen" parent="Theme.SplashScreen"><item name="postSplashScreenTheme">@style/AppTheme</item><item name="android:windowSplashScreenBehavior">icon_preferred</item></style></resources>');
    await writeFile(path.join(res, "values-v33/styles.xml"), '<resources><style name="Unrelated"><item name="colorAccent">blue</item></style></resources>');
    await writeFile(path.join(root, "app/src/main/AndroidManifest.xml"), '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32"/><uses-permission android:name="android.permission.INTERNET"/><application android:name=".MainApplication" android:requestLegacyExternalStorage="true" android:label="Animu"/></manifest>');
    const png = Buffer.from([137,80,78,71,13,10,26,10,0,0]);
    await writeFile(path.join(res, "mipmap-hdpi/ic_launcher.webp"), png);
    await writeFile(path.join(res, "mipmap-hdpi/ic_launcher_round.webp"), "RIFF WEBP");
    await fixReleaseResources(root);
    const basePath = path.join(res, "values/styles.xml");
    const qualifiedPath = path.join(res, "values-v33/styles.xml");
    const base = await XML.readXMLAsync({ path: basePath });
    const qualified = await XML.readXMLAsync({ path: qualifiedPath });
    expect(base.resources.style[0].item[0]._).toBe("purple");
    expect(base.resources.style[1].item).toHaveLength(1);
    expect(qualified.resources.style[0].$.name).toBe("Unrelated");
    expect(qualified.resources.style[1].$.parent).toBe("Theme.SplashScreen");
    expect(qualified.resources.style[1].item).toHaveLength(2);
    expect(await readFile(path.join(res, "mipmap-hdpi/ic_launcher.png"))).toEqual(png);
    expect(await readFile(path.join(res, "mipmap-hdpi/ic_launcher_round.webp"), "utf8")).toBe("RIFF WEBP");
    const manifest = await XML.readXMLAsync({ path: path.join(root, "app/src/main/AndroidManifest.xml") });
    expect(manifest.manifest.application[0].$).toEqual({ "android:name": ".MainApplication", "android:label": "Animu" });
    expect(manifest.manifest["uses-permission"][0].$["android:maxSdkVersion"]).toBe("28");
    const before = await readFile(qualifiedPath, "utf8");
    await fixReleaseResources(root);
    expect(await readFile(qualifiedPath, "utf8")).toBe(before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
