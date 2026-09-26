# Fonts

The `.ttf` files in this folder are **not committed** to this repository; they
are listed in the root `.gitignore`.

The app uses **Proxima Nova** for all text.

## Local development

Place the `Regular` and `Bold` styles here as:

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
