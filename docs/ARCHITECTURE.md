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
| **Data** | `packages/animu-api` | The `animu-api` submodule owns all HTTP, wire DTOs, valibot schemas and DTO→domain mapping. |
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

Playback runs on **[react-native-airwave](https://github.com/rmotafreitas/react-native-airwave)**,
a native-first player: its native engine owns the state machine, reconnects,
stall / dead-socket / network recovery, live-edge resumes, audio focus,
interruptions, the lock screen and remote commands, and background keepalive.
None of that runs in JS any more, so it keeps working while JS timers are
frozen.

`src/core/player` adds what only the app knows:

| Module | Responsibility |
| --- | --- |
| `player-service.ts` (`PlayerService`) | Which stream to play, commands, store writes, lock-screen metadata; follows Airwave's status |
| `stream-playback/heard-track.ts` (`HeardTrack`) | What the listener is **hearing** and how far into it (see below) |
| `stream-playback/now-playing.repository.ts` (`NowPlayingRepository`) | On-air data: realtime SSE + HTTP fallback, diffing merge, history, listeners, error backoff (`backoff.ts`) |
| `stream-playback/stream-preferences.ts` | Persisted stream-quality choice |
| `visualizer/audio-sampler.ts` (`AudioSampler`) | Oscilloscope windows from Airwave's `audioSample` events (pacing, delay, draw gain) |
| `media-session/now-playing.metadata.ts` | Pure mapper: track → lock-screen fields (anime as title, cover, duration) |
| `storage/` | Cover resolution, disk/image caches and the bundled default |
| `artwork-prefetch.ts` | Warms an announced track's cover before it is heard |
| `player-factory.ts` | Composition root and the `playerService()` singleton |
| `store.ts` | The three external stores and the UI's `TransportState` |
| `ports.ts` | The slice of Airwave's `Player` the core uses (faked in tests) |

### What is heard: ICY titles

The station's ICY title is exactly the API's `rawtitle`, and it changes about
1.2 s after the API's `timestart` (measured: 67 track changes over 3 hours,
0.34–1.85 s, every title matching). Airwave delivers each ICY title **when it
becomes audible** (iOS: AVPlayer's metadata output; Android: Media3's metadata
renderer). So an ICY change means "this track is starting *now*, here":
`HeardTrack` shows the API track whose `raw` equals the title, at 1.2 s, and
the position advances while audio flows.

The first title after tuning in (or after a re-open at the live edge) is
already partway: its position is the station clock minus how far the speaker
trails the live edge (`getProgress().liveOffset ?? bufferedAhead`), with a
server clock correction from HTTP `date` headers when the device clock is
grossly wrong. The next track boundary is exact again.

The lock screen gets `updateNowPlaying({ …, duration, elapsed })`; Airwave
advances the song's progress natively, only while audio plays. No JS timer is
involved, which matters on Android: React Native fires no JS timers while the
activity is backgrounded, but native events (ICY titles, status) still run JS.

## State stores
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

The foreground ticker (1 Hz, only while the app is visible) writes progress
and polls the API every **5 s** while audio is wanted and every **30 s**
while paused. In the background nothing polls: the SSE stream and the audible
ICY titles keep the lock screen current.

## Repository layout

```
src/
├── api/                  # App-level URLs + the shared animu-api client (expo/fetch)
├── assets/               # Localized artwork, fonts and icons
├── components/           # Reusable UI (player, sheets, drawer, dialogs, avatar…)
├── constants/            # Auth/OAuth provider metadata, default settings
├── contexts/             # Player, Auth, UserSettings, Alert, Portal providers
├── core/
│   ├── assistant/        # Deep-link handler for Siri / Google Assistant
│   ├── auth/             # AuthFacade + ports (API, OAuth, session store)
│   ├── domain/           # Thin re-exports of animu-api entities + helpers
│   ├── player/           # Playback engine (transport, repository, orchestrator…)
│   └── services/         # API facade, requests, background tasks, settings
├── hooks/                # Shared hooks (dict, retry, clipboard, request flows)
├── i18n/                 # PT / EN / ES / JP dictionaries
├── routes/               # Navigation (native stack over the drawer)
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
  runtime dependencies (`valibot` is the only peer), so there is no HTTP client
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
- **Real track progress in the media session.** The radio plays server-side,
  so a song's progress is not the player's stream position. The song becomes
  audible with its ICY title; from then on Airwave advances the lock-screen
  position natively (`updateNowPlaying({ duration, elapsed })`), frozen while
  audio does not flow.
- **Realtime now-playing over SSE, with HTTP fallback.** `NowPlayingRepository`
  prefers the station's Server-Sent Events stream (`animu.live`) for track and
  listener updates and silently reverts to HTTP polling for the metadata when
  the stream goes quiet (`LIVE_STALE_MS` = 15 s). History and program still come
  from HTTP on the poll cadence.
- **Playback lives natively.** Reconnects, stall and dead-stream detection,
  network handoffs, live-edge resumes, audio focus and interruptions (with
  their reasons), background keepalive and the single media session are
  Airwave's. Lock-screen, headset, Bluetooth and car commands reach the native
  engine directly; the app follows the status events.
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
- **Audio visualizer without microphone permission, on both platforms, drawn
  by a WebView canvas.** Airwave streams the decoded audio as `audioSample`
  windows (mono, 1024 points, with the delay until heard): on Android from an
  ExoPlayer audio-sink tap, on iOS by decoding the stream's bytes in parallel
  (AVPlayer never runs an audio tap on HTTP streams). `AudioSampler` paces the
  windows; a **transparent `react-native-webview`** hosts the *web player's
  own oscilloscope page* (`player.animu.moe`'s `drawOscilloscope`), which
  interpolates between windows and strokes a `<canvas>` once per
  `requestAnimationFrame`. The component unmounts while backgrounded, and the
  page has no audio element of its own.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | React Native 0.86.3 · React 19.2.3 (New Architecture) |
| Build tooling | Expo SDK 57 · EAS Build · Expo dev client |
| Language | TypeScript 6.0 (strict) |
| Navigation | React Navigation 7 — a **native stack** (`@react-navigation/native-stack`) whose root is the **drawer** (`@react-navigation/drawer`: Player, history, Make Request); Settings, Stats, Storage, Login, Account and About push on the stack (platform push/pop, iOS swipe-back, Android predictive back; cross-fade with Reduce Motion) |
| Audio | `react-native-airwave` (native engine, recovery, focus/interruptions, media session, ICY at audible time, decoded-audio sampling) — vendored tarball in `vendor/` |
| Visualizer | Transparent `react-native-webview` running the web player's Canvas 2D + `requestAnimationFrame` loop, fed by Airwave's `audioSample` windows (iOS and Android); unmounted while backgrounded (`AppStateGate` + `react-freeze`) |
| Icons | `@react-native-vector-icons/material-icons` · `react-native-svg` (only `ProviderIcon`, `SocialIcon`, `BackArrow`) |
| Images | `expo-image` (covers, avatars, localized artwork) |
| Auth | `animu-api` Auth v5 · `expo-auth-session` + `expo-web-browser` (Discord/Google OAuth 2.0 + PKCE) · `expo-apple-authentication` (Apple) |
| State | React Context · custom external stores (`useSyncExternalStore`) |
| Storage | `expo-secure-store` (session token) · `@react-native-async-storage/async-storage` (settings + profile projection) |
| Realtime | `animu-api` SSE stream (`animu.live`) with HTTP polling fallback |
| Networking | `expo/fetch` + `AbortController` |
| API client | `animu-api` submodule (valibot-validated DTOs) |
| Background | Playback and its recovery are native (Airwave); JS task runner gated by app visibility for the rest |
| i18n | Custom dictionary-based localization (PT/EN/ES/JP) |
| Testing | Vitest (player core, services, domain, hooks, plugins) |
