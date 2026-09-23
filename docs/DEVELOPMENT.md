# Development

How to get the app running locally, the scripts you'll use every day, and the
project-specific gotchas.

## Prerequisites

- **Node.js 20+** (CI uses Node 22).
- [Expo CLI](https://docs.expo.dev/more/create-expo/) and an Expo account (for EAS).
- **Android Studio** / **Xcode** toolchains for native builds.
- A device or emulator. The app targets a live station backend, so most features
  require network access to `animu.moe`.
- The licensed **Proxima Nova** font files — they are commercial and are **not**
  committed to this repository. See [Fonts](#fonts).

## Clone & install

```bash
git clone --recurse-submodules https://github.com/RadioAnimu/animu-mobile-app.git
# already cloned? git submodule update --init --remote

npm install        # applies native patches via postinstall and builds animu-api
```

`npm install` runs `postinstall`, which applies `patch-package` and builds the
`animu-api` submodule when needed (`npm run build:api`).

## Run

```bash
npm run start      # Expo dev client
npm run android    # build & run on Android
npm run ios        # build & run on iOS
npm run web        # Expo web (limited; some native modules are unavailable)
```

> This project uses a **development client** (`expo start --dev-client`) rather
> than Expo Go, because it depends on native modules
> (`react-native-playback-controls`, `react-native-webview`) and patched builds
> applied via `patch-package` (`patches/`): playback-controls (notification
> artwork/teardown) and expo-audio (permission-free Android PCM sampling for the
> visualizer). `expo-audio` is opted into source builds via
> `expo.autolinking.buildFromSource` in `package.json` — without it, Expo would
> link the precompiled AAR and the patch would be ignored.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run start` | Expo dev client |
| `npm run android` / `npm run ios` | Native build & run |
| `npm run web` | Expo web |
| `npm test` | Vitest (player core, services, domain, hooks, plugins) |
| `npm run lint` | `expo lint` (flat ESLint config) |
| `npm run build:api` | Build the `animu-api` submodule |
| `npm run fonts` | Fetch the licensed fonts (`scripts/fetch-fonts.mjs`) |
| `npm run splash` | Regenerate splash assets |
| `npm run ota:ios` / `ota:android` | Export Hermes bytecode bundles locally |
| `npm run doctor` | React Doctor health scan |
| `npm run install:apk` | Uninstall + install the newest local `.apk` on a connected device |

Typecheck directly with `npx tsc --noEmit` (there is no npm alias).

## Testing

Tests use **Vitest** and live next to the code in `__tests__` folders:

- `src/core/player/__tests__` — playback units with injected `Timer`/fetcher fakes.
- `src/core/services/__tests__` — orchestration, background tasks, settings.
- `src/core/domain/__tests__` — pure helpers.
- `src/hooks/__tests__`, `plugins/__tests__` — hooks and config plugins.

```bash
npm test
```

## Path aliases

App code imports through `@/*` (→ `src/*`) and `@app/*` (→ project root) instead
of relative paths. They are declared in `tsconfig.json`, consumed by Metro
through Expo's built-in tsconfig-paths support, and mirrored in
`vitest.config.mts`. ESLint enforces the alias for `src/`, `App.tsx` and
`index.js`; Node-loaded tooling (`babel`/`metro`/`eslint` configs, `scripts/`)
keeps using relative requires.

## Fonts

The app uses **Proxima Nova** by Mark Simonson Studio. It is a commercial
typeface and its license does **not** permit redistribution in a public
repository, so the files are gitignored.

1. Purchase an **App license** at
   <https://www.marksimonson.com/fonts/view/proxima-nova>.
2. Place `Regular` and `Bold` here:

   ```
   src/assets/fonts/proximanova-reg.ttf
   src/assets/fonts/proximanova-bold.ttf
   ```

`app.json` (the `expo-font` config plugin) and `scripts/generate-splash.mjs`
expect exactly these two paths.

For EAS cloud builds (which check out the repo without gitignored files),
`scripts/fetch-fonts.mjs` runs via the `eas-build-pre-install` hook and supplies
them from either `PROXIMA_NOVA_FONTS_URL` (a `.zip`) or
`PROXIMA_NOVA_FONTS_DIR` (a directory). See
[`src/assets/fonts/README.md`](../src/assets/fonts/README.md) for the full
walk-through.

## Patches

Native patches live in `patches/` and are applied automatically by
`patch-package` on install:

- **`react-native-playback-controls`** — notification artwork/seekability and
  teardown (reads inline artwork bytes so the system notification loader never
  races a `file://` URI under scoped storage).
- **`expo-audio`** — permission-free Android PCM sampling for the visualizer
  (see [Architecture](ARCHITECTURE.md#key-engineering-decisions)).
- **`react-native-ota-hot-update`** — adds the missing iOS
  `PrivacyInfo.xcprivacy` privacy manifest.

If you change a patch, regenerate it with `npx patch-package <package>` and
verify a clean `npm install` still applies it.

## Submodule

`packages/animu-api` is a [git submodule](https://git-scm.com/docs/git-submodule)
pointing at the separate [`RadioAnimu/animu-api`](https://github.com/RadioAnimu/animu-api)
repository. Always clone with `--recurse-submodules`, and after pulling run:

```bash
git submodule update --init --remote
npm run build:api
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

1. Build the `animu-api` submodule.
2. `npx tsc --noEmit` — typecheck.
3. `npx expo lint` — lint.
4. `npm test` — Vitest.
5. **Bundle smoke test** — `expo export:embed` for Android, catching broken asset
   paths and unresolvable imports that TypeScript can't see.
6. **React Doctor score gate** — fails if the health score drops below **85**.

`react-doctor.yml` posts advisory PR feedback separately.

## Troubleshooting

- **Native module missing / "requires dev client"** — you ran Expo Go. Use
  `npm run android` / `npm run ios` (dev client).
- **Visualizer unavailable on iOS** — expected; the feature is Android-only.
- **`animu-api` build errors after a pull** — run `git submodule update --init
  --remote && npm run build:api`.
- **Metro can't resolve `@/…`** — confirm `tsconfig.json` paths and restart with
  `npx expo start --clear`.
