# Architecture

The codebase follows a **clean, layered architecture** that keeps the UI
decoupled from external systems. Everything below the UI is composed from
small, constructor-injected units, which makes the bulk of the app unit-testable
with plain fakes.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| **Domain** | `src/core/domain` | Thin re-exports of the `animu-api` entities (`Track`, `Stream`, `Listeners`, `User`…) and helpers (`getTrackProgress`, `isRealTrack`, `getUserName`) — one import path, no app-side duplication. The package's mappers own parsing/filler-filtering. |
| **Auth** | `src/core/auth` | Ports & adapters around the Animu Auth API v5 plus an `AuthFacade` that owns OAuth→session exchange, persistence and account rules. |
| **Player core** | `src/core/player` | The playback engine — small, focused units composed by a thin orchestrator. |
| **Services** | `src/core/services` | Application orchestration — API facade, music/live requests, background tasks and user settings. |
| **Data** | `packages/animu-api` | The `animu-api` submodule owns all HTTP, wire DTOs, zod schemas and DTO→domain mapping. |
| **UI** | `src/screens`, `src/components`, `src/contexts`, `src/theme` | React Native screens, reusable components, providers and design tokens. |

![Architecture diagram](SCREENSHOT: a diagram of the layers above — Domain, Auth, Player core, Services, animu-api submodule and UI — with arrows showing UI → services/contexts → core → animu-api)


## Auth stack

The auth stack follows the same **ports & adapters** discipline:

- `src/core/auth/ports.ts` defines `AuthApiPort`, `OAuthPort` and
  `SessionStorePort`.
- Adapters wrap the `animu-api` client, `expo-web-browser` / `expo-auth-session`
  (the browser OAuth redirect flows) and `expo-apple-authentication` (Apple),
  plus `expo-secure-store` + `AsyncStorage` for the session.
- Views never import the package's auth client directly — they call the
  `AuthFacade` through `useAuth()`.

The session token lives in the device keychain; the non-sensitive profile
projection lives in plain storage. Legacy plaintext sessions are migrated on
first read.

## Player core

`src/core/player` decomposes playback into small, testable units composed by a
**thin orchestrator** (`PlayerService`, `player-service.ts`) that owns no
playback or data logic itself — it only routes events between units and is the
single writer of the React stores.

The **only** modules that import a native media library are the adapters; the
rest of the engine depends on the ports in `ports.ts` (`AudioEnginePort`,
`MediaSessionPort`, the shared value types, and the `Timer` seam). Groups:

| Group | Modules | Responsibility |
| --- | --- | --- |
| `ports.ts` | — | Library-agnostic vocabulary: `AudioEnginePort`, `MediaSessionPort`, `Timer`; imports no native media lib |
| `adapters/` | `ExpoAudioAdapter` | The `AudioEnginePort` backed by `expo-audio` — player + audio-session lifecycle (create/replace/resume/pause, status events, decoded-PCM sample channel) |
| `adapters/` | `PlaybackControlsAdapter` | The `MediaSessionPort` backed by `react-native-playback-controls` — now-playing metadata/status/position + remote (lock-screen) commands |
| `stream-playback/` | `transport-state` | Explicit play-intent lifecycle (`idle → connecting → playing/paused/reconnecting`) and its status mapping |
| `stream-playback/` | `backoff` (`BackoffScheduler`) | Reusable exponential-backoff timer — stream reconnects and data retries (base 2 s, cap 30 s) |
| `stream-playback/` | `now-playing.repository` (`NowPlayingRepository`) | On-air data: realtime SSE ingest + HTTP fallback, parallel fetch, diffing merge, predictive track-end refresh, error backoff |
| `stream-playback/` | `stream-sync` (`StreamSyncEngine`) | Maps the station timeline onto the audible stream (live offset, `SyncAnchor`, `getSyncedTrackProgress`) |
| `stream-playback/` | `audible-track` (`AudibleTrackResolver`) | Resolves which track the listener is actually hearing during transitions/SSE gaps |
| `stream-playback/` | `heartbeat` (`HeartbeatScheduler`) | 1 Hz gate collapsing the native + JS drivers; watchdog; data-poll cadence; fed natively while backgrounded |
| `stream-playback/` | `progress-ticker` (`ProgressTicker`) | 1 Hz progress tick — progress store updates, track-end detection, native position push |
| `stream-playback/` | `network-monitor` (`NetworkMonitor`) | Offline → online transitions (via `@react-native-community/netinfo`) for instant reconnect + data refresh |
| `stream-playback/` | `stream-preferences` (`StreamPreferences`) | Persisted stream-quality choice with corrupt-storage safety |
| `stream-playback/` | `live-buffer.android` / `.ios` | Per-platform live-edge buffer policy — `0` on both, but iOS documents why capping the forward buffer distorts the measured lag |
| `visualizer/` | `audio-sampler` (`AudioSampler`) + `waveform` + `index.android`/`index.ios` | Android-only PCM sampling + DSP; iOS factory returns a `NoopVisualizerSampler`, so the whole DSP never bundles on iOS |
| `media-session/` | `now-playing.metadata` (`buildNowPlayingMetadata`) | Pure mapper: app state → native media-session metadata |
| `storage/` | `artwork` (`ArtworkResolver`), `cover-file-cache`, `cover-image-cache`, `cover-ports` | Cover resolution, disk/image caches and the bundled default |
| root | `player-service.ts` (`PlayerService`) | The thin orchestrator — composes the units, routes events, writes the stores |
| root | `store.ts` | The three external stores |
| root | `timer.ts` | The shared scheduling port (`Timer`, `jsTimer`) |

The units communicate through narrow, constructor-injected dependencies (the
`Timer` abstraction replaces raw `setTimeout`, fetchers and connectivity
subscriptions are injectable). Tests live in the per-folder `__tests__`
directories and in `src/core/services/__tests__`, and run with `npm test`.

## State stores

Snapshot state reaches React through **three external stores split by change
cadence** (all built on `useSyncExternalStore` with shallow-equality diffing),
so components opt into the granularity they need — a listener-count poll never
re-renders the now-playing UI, and a 1 Hz progress tick never re-renders
anything but progress:

| Store | Snapshot | Cadence | Consumed via |
| --- | --- | --- | --- |
| `playerStore` | current track/program/stream, stream options, `isPlaying`, `playbackState`, `isInitialized` | per song / per action | `usePlayer()` |
| `stationStore` | current listeners, request/played histories | per API poll (see cadence below) | `useStation()` |
| `progressStore` | track progress, `showProgress` | every 1s | `useTrackProgress()` |

The data-poll cadence is decided once, in `HeartbeatScheduler`: **5 beats**
(≈5 s) playing in the foreground, **30** paused in the foreground, **30**
playing in the background and **60** paused in the background. Beats come from
either driver — the native `playbackStatusUpdate` stream (which keeps firing
while backgrounded) or the JS heartbeat task — and the gate collapses them to
≤1 Hz so concurrent drivers cost a single beat.

## Repository layout

```
src/
├── api/                  # App-level URLs + the shared animu-api client (expo/fetch)
├── assets/               # Localized artwork, fonts and icons
├── components/           # Reusable UI (player, sheets, drawer, dialogs, avatar…)
├── constants/            # Auth/OAuth provider metadata, OTA feed, default settings
├── contexts/             # Player, Auth, UserSettings, Alert, Portal providers
├── core/
│   ├── assistant/        # Deep-link handler for Siri / Google Assistant
│   ├── auth/             # AuthFacade + ports (API, OAuth, session store)
│   ├── domain/           # Thin re-exports of animu-api entities + helpers
│   ├── ota/              # Over-the-air bundle service (runtime-version guard)
│   ├── player/           # Playback engine (transport, repository, orchestrator…)
│   └── services/         # API facade, requests, background tasks, settings
├── hooks/                # Shared hooks (dict, retry, clipboard, request flows)
├── i18n/                 # PT / EN / ES / JP dictionaries
├── routes/               # Navigation (drawer)
├── screens/              # Home, History, MakeRequest, Settings, Storage, Login, Account, About
├── theme/                # Design tokens (colors, spacing, radii, typography)
└── @types/               # Ambient type declarations
```

## Path aliases

App code imports through `@/*` (→ `src/*`) and `@app/*` (→ project root) instead
of relative paths. They are declared in `tsconfig.json`, consumed by Metro
through Expo's built-in tsconfig-paths support, and mirrored in
`vitest.config.mts` for the test runner. An ESLint rule (`no-restricted-imports`
+ a relative-`require` selector) enforces this for `src/`, `App.tsx` and
`index.js`; Node-loaded tooling (`babel`/`metro`/`eslint` configs, `scripts/`)
keeps using relative requires.

## Key engineering decisions

- **Custom HTTP layer instead of a third-party client.** The `animu-api`
  package ships a small `fetch`-based client with `AbortController` timeouts, an
  in-memory GET micro-cache, structured request logging and typed errors — zero
  runtime dependencies (`zod` is the only peer), so there is no HTTP client
  package to keep current.
- **`expo/fetch` for background reliability.** The shared client injects
  `expo/fetch`, whose dedicated native OkHttp stack keeps working while the app
  is backgrounded and cancels hung calls natively — React Native's default
  `NetworkingModule` pool can wedge in the background and freeze now-playing
  updates.
- **Predictive track-end refresh.** The client knows each track's `startTime`
  and `duration`, so it schedules a metadata refresh just before the track ends
  (`startTime + duration + buffer`) — keeping the UI ahead of the station
  instead of polling blindly.
- **Exponential backoff.** Consecutive API/network failures retry at 2 s → 4 s →
  8 s → … capped at 30 s, resetting on the first success. Combined with the
  track-end scheduler, the app recovers from transient outages without user
  intervention.
- **Real track progress in the media session.** The radio plays server-side, so
  progress derives from the station's `startTime` + `duration`
  (`getTrackProgress` in `animu-api`), not from the player's internal position —
  which on ICY streams is stream time, not track time. The app pushes
  `durationSec` and periodically re-pushes the elapsed position, letting the OS
  interpolate the seek bar between snapshots.
- **Realtime now-playing over SSE, with HTTP fallback.** `NowPlayingRepository`
  prefers the station's Server-Sent Events stream (`animu.live`) for track and
  listener updates and silently reverts to HTTP polling for the metadata when
  the stream goes quiet (`LIVE_STALE_MS` = 15 s). History and program still come
  from HTTP on the poll cadence.
- **Visibility-gated, self-rescheduling polling.** The app-level task runner
  (`background.service.ts`) re-arms each task only after the previous run
  settles, so a slow poll never overlaps itself. The `HeartbeatScheduler`
  decides the cadence once: 5 s playing in the foreground, 30 s paused in the
  foreground, and 30 s / 60 s in the background (playing / paused). Returning to
  the foreground always triggers an immediate refresh.
- **Native heartbeat while backgrounded.** A `playbackStatusUpdate` event beats
  the 1 Hz `HeartbeatScheduler` from the native player, driving progress,
  media-session pushes and the data poll even when JS timers are frozen or
  throttled — so a live show's notification never keeps a stale title/cover.
- **Provider-agnostic auth.** `AuthFacade` composes three ports (API, OAuth,
  session store). Provider quirks stay in the adapters: Discord, Google and
  Fluxer delegate the whole redirect to the backend (`mode: "server"` →
  `/mobile/<provider>-start.php` in a browser session), Apple prefers the native
  iOS sheet (`expo-apple-authentication`) and uses the server redirect on
  Android, and Animu Connect is a passwordless email-code exchange. The provider
  list is fetched at runtime (`getProviders()`), with a Discord/Google/Apple
  fallback when it is unreachable.
- **Auth that survives relaunch.** The OAuth/provider code is exchanged on the
  Animu backend for a session token, persisted to the device keychain
  (`expo-secure-store`, with the non-sensitive profile projection in
  `AsyncStorage` and legacy plaintext sessions migrated on first read),
  rehydrated on cold start, and re-checked every 60 s by a background task.
- **Audio visualizer without microphone permission, drawn by a WebView canvas
  (Android).** The app taps the player's own decoded PCM instead of the
  microphone. `expo-audio` is patched (`patches/expo-audio+57.0.5.patch`) to
  replace the `android.media.audiofx.Visualizer` sampler — which the OS gates
  behind `RECORD_AUDIO` — with an ExoPlayer `TeeAudioProcessor` tap on the
  decoded playback stream, so no permission is requested. Because Expo can ship
  `expo-audio` as a precompiled AAR, `package.json` opts it into source builds
  (`expo.autolinking.buildFromSource: ["expo-audio"]`) so the patch is compiled.
  The native tap delivers a PCM window only at the audio-buffer rate (~25–40 Hz)
  and its window does not advance between taps, so `AudioSampler` down-mixes to
  mono, resamples to 1024 points and publishes each window with its measured
  interval. A **transparent `react-native-webview`** hosts the *web player's own
  oscilloscope page* (`player.animu.moe`'s `drawOscilloscope`): it receives the
  windows over a small hex bridge, interpolates between the last two windows
  over their measured cadence and strokes a `<canvas>` once per
  `requestAnimationFrame` (device vsync). So the renderer is Canvas 2D in a
  WebView — **not** `react-native-svg` (which this app uses only for
  `ProviderIcon`, `SocialIcon` and `BackArrow` icons). The component unmounts
  while backgrounded (its `wantsOn` gate includes `isBackgrounded`), and
  `react-freeze` via `AppStateGate` stops the rest of the tree re-rendering. The
  app never plays a second stream: the page has
  no audio element and receives PCM over `postMessage`. On iOS the expo-audio
  `MTAudioProcessingTap` hook installs on a live `AVPlayer` item but its render
  callback never fires for indefinite HTTP audio, so the sampler is a no-op and
  the entire visualizer is excluded from the iOS bundle via platform-suffixed
  modules.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | React Native 0.86.3 · React 19.2.3 (New Architecture) |
| Build tooling | Expo SDK 57 · EAS Build · Expo dev client |
| Language | TypeScript 6.0 (strict) |
| Navigation | React Navigation 7 — **drawer** (`@react-navigation/drawer`); no native-stack dependency |
| Audio | `expo-audio` (patched on Android for permission-free PCM sampling) · `react-native-playback-controls` (OS media session) |
| Visualizer (Android) | Transparent `react-native-webview` running the web player's Canvas 2D + `requestAnimationFrame` loop, fed by the Android-only `AudioSampler` (ExoPlayer `TeeAudioProcessor`); unmounted while backgrounded (`AppStateGate` + `react-freeze`). Platform-split (`.android`/`.ios`) so iOS bundles nothing |
| Icons | `@react-native-vector-icons/material-icons` · `react-native-svg` (only `ProviderIcon`, `SocialIcon`, `BackArrow`) |
| Images | `expo-image` (covers, avatars, localized artwork) |
| Auth | `animu-api` Auth v5 · `expo-auth-session` + `expo-web-browser` (Discord/Google OAuth 2.0 + PKCE) · `expo-apple-authentication` (Apple) |
| State | React Context · custom external stores (`useSyncExternalStore`) |
| Storage | `expo-secure-store` (session token) · `@react-native-async-storage/async-storage` (settings + profile projection) |
| Realtime | `animu-api` SSE stream (`animu.live`) with HTTP polling fallback |
| Networking | `expo/fetch` + `AbortController` · `@react-native-community/netinfo` (connectivity) |
| Updates | `react-native-ota-hot-update` + `react-native-blob-util` (OTA bundle download) |
| API client | `animu-api` submodule (zod-validated DTOs) |
| Background | JS task runner gated by app visibility + native playback-status heartbeat (no OS background-task module) |
| i18n | Custom dictionary-based localization (PT/EN/ES/JP) |
| Testing | Vitest (player core, services, domain, hooks, plugins) |
