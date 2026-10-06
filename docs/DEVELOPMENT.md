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
# already cloned? git submodule update --init --recursive

pnpm install       # prepares both pinned libraries
```

`pnpm install` prepares both linked submodules from matching Jenkins artifacts
or isolated source builds. See [shared submodule builds](BUILD_AND_RELEASE.md#shared-submodule-builds).
Use `pnpm run build:api` / `pnpm run build:player` to prepare either manually.

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
> than Expo Go, because it depends on native modules (`react-native-anything-player`,
> `react-native-webview`).

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
| `pnpm run doctor:gate` | React Doctor gate (fails on any finding, same as CI) |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run check:expo-doctor` | `expo-doctor`: app config schema, duplicate native modules, SDK compatibility |
| `pnpm run check:expo-deps` | `expo install --check`: every Expo-managed dependency matches the SDK |
| `pnpm run check:audit` | `pnpm audit` for known-vulnerable dependencies |
| `pnpm run check:animu-api` | Typecheck and test the `animu-api` submodule |
| `pnpm run check:player` | Typecheck and test the `react-native-anything-player` submodule (own Yarn install, removed afterwards) |
| `pnpm run install:apk` | Uninstall + install the newest local `.apk` on a connected device |


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

## Player library (react-native-anything-player)

Playback uses `react-native-anything-player`, the git submodule at
`packages/react-native-anything-player` ([rmotafreitas/react-native-anything-player](https://github.com/rmotafreitas/react-native-anything-player),
a **private** repository: cloning it needs read access). It is consumed from
compiled JavaScript and pinned native source:

- `link:` dependency (a symlink in `node_modules`), and **not** a pnpm workspace
  member. As a member, its devDependencies (its own `react-native`, Jest, the
  example app) would be installed into the app's tree, and Metro would bundle
  two React Natives.
- Metro and TypeScript resolve the compiled `lib/` exports, prepared by
  `pnpm install`; Metro blocks the submodule's own installs and example apps.
- iOS/Android autolinking compile its `ios/` and `android/` directly.
- `tsc`, Vitest, ESLint and React Doctor skip the submodule's own project
  (`react-doctor.config.json` selects the app). It has its own CI; run its
  checks here with `pnpm run check:player`.

To update the player, commit and push in the Airwave repository, then move the
pin:

```bash
git -C packages/react-native-anything-player pull origin main
git add packages/react-native-anything-player
```

No reinstall is needed (it is a symlink). Rebuild the native app when native
code changed.

No native patches are needed (`patch-package` was removed with the last patch).

## Submodules

Two [git submodules](https://git-scm.com/docs/git-submodule) live in
`packages/`: `animu-api` ([`RadioAnimu/animu-api`](https://github.com/RadioAnimu/animu-api))
and `react-native-anything-player` (private, see
[Player library](#player-library-react-native-anything-player)). Always clone with
`--recurse-submodules`. CI checks them out with `scripts/init-submodules.sh`,
which authenticates to the private repository with `AIRWAVE_READ_TOKEN` when
set. After pulling, run:

```bash
git submodule update --init --recursive
pnpm run build:api
```

The library also has its own Jenkins job that archives a prebuilt `dist/`; the
release pipeline consumes that for the pinned commit when available. See
[Build & Release](BUILD_AND_RELEASE.md#packagesanimu-api).

## Continuous integration

`.github/workflows/ci.yml` and the Jenkins `animu-mobile-app` job run on every
push to `main` and on pull requests:

1. `pnpm install --frozen-lockfile` (which builds the `animu-api` submodule).
2. `pnpm run typecheck` — typecheck.
3. `pnpm run lint` — lint (SonarJS rules run as errors on production code).
4. `pnpm run check:expo-deps` — Expo SDK dependency alignment, then
   `pnpm run check:expo-doctor` — `expo-doctor` project health checks.
5. `pnpm run check:audit` — dependency vulnerability audit.
6. `pnpm test:coverage` — Vitest with the coverage floor (writes `junit.xml` when `CI` is set).
7. `pnpm run check:animu-api` and `pnpm run check:player` — the submodules'
   own typecheck and tests.
8. **Bundle smoke test** — `expo export:embed` for Android, catching broken asset
   paths and unresolvable imports that TypeScript can't see.
9. **React Doctor gate** — `pnpm run doctor:gate`, fails on any finding.

`react-doctor.yml` posts advisory PR feedback separately.

The private Airwave submodule needs a read-only token in CI: a fine-grained
personal access token with **Contents: read** on `rmotafreitas/react-native-anything-player`,
stored as the GitHub Actions secret `AIRWAVE_READ_TOKEN` and as the Jenkins
SSH credential `airwave-read-key` (used by the CI, release and
SonarQube jobs).

`pnpm run check:audit` ignores two advisories with no fixed release, both in
Expo's build/dev tooling and not in the app bundle (`node-forge`, `braces`).
They are listed with their reasons under `auditConfig` in `pnpm-workspace.yaml`;
remove each once a fix ships.

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
