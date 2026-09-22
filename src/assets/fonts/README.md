# Fonts

The `.ttf` files in this folder are **not committed** to this repository.

The app uses **Proxima Nova** by Mark Simonson Studio. It is a commercial
typeface: the files are Copyright (c) Mark Simonson, 2005, all rights reserved,
and the font license does **not** permit redistribution in a public repository
(including embedding the files in an open-source project). Committing them here
would violate that license, so they are listed in the root `.gitignore`.

## Local development

1. Purchase an **App license** for Proxima Nova at
   <https://www.marksimonson.com/fonts/view/proxima-nova> (priced per app title;
   one license covers both iOS and Android).
2. Export/install the **TrueType (`.ttf`)** or **OpenType (`.otf`)** styles
   `Regular` and `Bold`.
3. Place them here as:

   ```
   src/assets/fonts/proximanova-reg.ttf
   src/assets/fonts/proximanova-bold.ttf
   ```

`app.json` (the `expo-font` config plugin) and `scripts/generate-splash.mjs`
expect exactly these two paths.

## EAS cloud builds

EAS checks out the repo in the cloud, so the gitignored files are absent.
`scripts/fetch-fonts.mjs` (run via the `eas-build-pre-install` hook) supplies
them from either:

- `PROXIMA_NOVA_FONTS_URL` — a URL to a `.zip` containing the two `.ttf` files
  (any folder layout); or
- `PROXIMA_NOVA_FONTS_DIR` — a directory containing the two files.

Store one of these as an EAS secret/environment variable, e.g.:

```bash
eas env:create --name PROXIMA_NOVA_FONTS_URL --value "https://…/fonts.zip" \
  --visibility secret --environment production --environment preview
```

Keep the zip in private storage you control. Do **not** point it at a public URL.
