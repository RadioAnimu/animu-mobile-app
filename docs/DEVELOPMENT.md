# Development

How to get the app running locally, the scripts you'll use every day, and the
project-specific gotchas.

## Prerequisites

- **Node.js 20+** (CI uses Node 22).
- **pnpm** — the project uses pnpm. Enable it via `corepack enable` (the pinned
  version is in `package.json` → `packageManager`), or install
  `pnpm@9` directly.
- [Expo CLI](https://docs.expo.dev/more/create-expo/) and an Expo account (for EAS).
- **Android Studio** / **Xcode** toolchains for native builds.
- A device or emulator. The app targets a live station backend, so most features
  require network access to `animu.moe`.
- The **Proxima Nova** font files — they are **not** committed to this
  repository. See [Fonts](#fonts).

## Clone & install

```bash
git clone --recurse-submodules https://github.com/RadioAnimu/animu-mobile-app.git
# already cloned? git submodule update --init --remote

pnpm install       # applies native patches via postinstall and builds animu-api
```

`pnpm install` runs `postinstall`, which applies `patch-package` and builds the
`animu-api` submodule when needed (`pnpm run build:api`).

> **Why `node-linker=hoisted`?** React Native/Expo need a flat `node_modules`;
> pnpm's default isolated linking breaks Metro resolution and native module
> autolinking. This is set in `.npmrc`. Don't remove it.

## Run

```bash
pnpm run start      # Expo dev client
pnpm run android    # build & run on Android
pnpm run ios        # build & run on iOS
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
| `pnpm run start` | Expo dev client |
| `pnpm run android` / `pnpm run ios` | Native build & run |
| `pnpm test` | Vitest (player core, services, domain, hooks, plugins) |
| `pnpm run lint` | `expo lint` (flat ESLint config) |
| `pnpm run build:api` | Build the `animu-api` submodule |
| `pnpm run fonts` | Fetch the Proxima Nova fonts (`scripts/fetch-fonts.mjs`) |
| `pnpm run splash` | Regenerate splash assets |
| `pnpm run doctor` | React Doctor health scan |
| `pnpm run install:apk` | Uninstall + install the newest local `.apk` on a connected device |

Typecheck directly with `pnpm exec tsc --noEmit` (there is no script alias).

## Testing

Tests use **Vitest** and live next to the code in `__tests__` folders:

- `src/core/player/__tests__` — playback units with injected `Timer`/fetcher fakes.
- `src/core/services/__tests__` — orchestration, background tasks, settings.
- `src/core/domain/__tests__` — pure helpers.
- `src/hooks/__tests__`, `plugins/__tests__` — hooks and config plugins.

```bash
pnpm test
```

## Path aliases

App code imports through `@/*` (→ `src/*`) and `@app/*` (→ project root) instead
of relative paths. They are declared in `tsconfig.json`, consumed by Metro
through Expo's built-in tsconfig-paths support, and mirrored in
`vitest.config.mts`. ESLint enforces the alias for `src/`, `App.tsx` and
`index.js`; Node-loaded tooling (`babel`/`metro`/`eslint` configs, `scripts/`)
keeps using relative requires.

## Fonts

The app uses **Proxima Nova**. The files are gitignored (not committed to this
repository), so add them locally or supply them at build time.

1. Place `Regular` and `Bold` here:

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

If you change a patch, regenerate it with `pnpm exec patch-package <package>`
and verify a clean `pnpm install` still applies it.

## Submodule

`packages/animu-api` is a [git submodule](https://git-scm.com/docs/git-submodule)
pointing at the separate [`RadioAnimu/animu-api`](https://github.com/RadioAnimu/animu-api)
repository. Always clone with `--recurse-submodules`, and after pulling run:

```bash
git submodule update --init --remote
pnpm run build:api
```

The library also has its own Jenkins job that archives a prebuilt `dist/`; the
release pipeline consumes that for the pinned commit when available. See
[Build & Release](BUILD_AND_RELEASE.md#packagesanimu-api).

## Continuous integration

`.github/workflows/ci.yml` and the Jenkins `animu-mobile-app` job run on every
push to `main` and on pull requests:

1. `pnpm install --frozen-lockfile` (which builds the `animu-api` submodule).
2. `pnpm exec tsc --noEmit` — typecheck.
3. `pnpm exec expo lint` — lint.
4. `pnpm test` — Vitest.
5. **Bundle smoke test** — `expo export:embed` for Android, catching broken asset
   paths and unresolvable imports that TypeScript can't see.
6. **React Doctor score gate** — fails if the health score drops below **85**.

`react-doctor.yml` posts advisory PR feedback separately.

## Troubleshooting

- **Native module missing / "requires dev client"** — you ran Expo Go. Use
  `pnpm run android` / `pnpm run ios` (dev client).
- **Visualizer unavailable on iOS** — expected; the feature is Android-only.
- **`animu-api` build errors after a pull** — run `git submodule update --init
  --remote && pnpm run build:api`.
- **Metro can't resolve `@/…`** — confirm `tsconfig.json` paths and restart with
  `pnpm exec expo start --clear`.
- **Metro can't resolve a workspace package after switching to pnpm** — make sure
  `.npmrc` still has `node-linker=hoisted` and re-run `pnpm install`.
