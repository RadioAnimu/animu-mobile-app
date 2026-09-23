# AltStore Distribution

Besides Google Play (and, eventually, the App Store), the iOS build is
distributed through a self-hosted [AltStore](https://altstore.io) source. It lets
testers sideload the IPA without an App Store listing.

## What's in `altstore/`

| File | Purpose |
| --- | --- |
| `source.json` | Modern AltStore / SideStore source — points at the `.ipa` assets and a `manifest.json` on GitHub Releases |
| `classic.json` | AltStore **Classic** source — points directly at a single `.ipa` with a `sha256` |
| `icon.png`, `header.png` | Source artwork |
| `screenshots/*.png` | Store screenshots used by the source listing |

Both sources describe the same app:

- Bundle ID: `com.nessjs.animu`
- Category: `entertainment`
- Tint: `#6BDB00`
- Minimum iOS: **15.1**

## Hosting

`.github/workflows/pages.yml` deploys the `altstore/` folder to **GitHub Pages**
whenever anything under `altstore/**` changes:

```
https://radioanimu.github.io/animu-mobile-app/           # source.json / classic.json
https://radioanimu.github.io/animu-mobile-app/icon.png
https://radioanimu.github.io/animu-mobile-app/header.png
https://radioanimu.github.io/animu-mobile-app/screenshots/1-home.png
```

Add the source in AltStore by URL:

```
https://radioanimu.github.io/animu-mobile-app/source.json
```

## Releasing a new AltStore version

1. Build a Release (device) IPA — the `preview` EAS profile with
   `ios.buildConfiguration: "Release"`, or an archive from Xcode.
2. Attach the IPA (plus `manifest.json` / `signature` for the modern source) to a
   GitHub Release.
3. Update `altstore/source.json`:
   - add a `versions[]` entry with `version`, `buildVersion`, `date`,
     `localizedDescription`, `downloadURL`, `size`, `minOSVersion` and the
     `assetURLs`;
   - update `source.json` / `classic.json`.
4. Update `screenshots/*` if the UI changed (see the residual IP note in
   [Store Submission](STORE_SUBMISSION.md#licensing--ip) — screenshots must not
   depict artwork you don't have rights to).
5. Commit and push — the Pages workflow redeploys automatically.

`altstore/*.ipa` is gitignored: IPAs are hosted on GitHub Releases, not committed.
