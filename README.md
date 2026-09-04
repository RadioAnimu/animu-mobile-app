# Animu Mobile App

> The official mobile client for [Rádio Animu](https://www.animu.moe) — Brazil's most moe radio.

[![Version](https://img.shields.io/badge/version-2.0.1-8A2BE2)](https://github.com/RadioAnimu/animu-mobile-app/releases)
[![React Native](https://img.shields.io/badge/React_Native-0.79-blue)](https://reactnative.dev)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-53-000000)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6)](https://www.typescriptlang.org)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-3DDC84)](https://play.google.com/store/apps/details?id=com.nessjs.animu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Founded on April 16, 2018, **Rádio Animu** is a non-profit Brazilian radio dedicated to spreading otaku culture. It plays anime songs, openings and endings, fansings, remixes, rhythm-game music, vocaloid tracks, and more — with a live DJ schedule, listener-driven requests, and community integration through Discord.

This repository is the official mobile application: a real-time internet-radio client built on React Native and Expo that mirrors the live station state — current track, cover art, live program, listener count, and request history — while keeping audio streaming and accurate now-playing metadata alive in the background.

- **Android** — available on the [Google Play Store](https://play.google.com/store/apps/details?id=com.nessjs.animu) (`com.nessjs.animu`)
- **iOS** — in development
- **Website** — [animu.moe](https://www.animu.moe) / [animu.com.br](https://www.animu.com.br)

> **📦 [`animu-api`](https://github.com/RadioAnimu/animu-api)** — the station's TypeScript API client, extracted from this app into its own repository and consumed here as a [git submodule](https://git-scm.com/docs/git-submodule) at `packages/animu-api`. It covers now playing, programs, history, music requests, live shout-outs, streams and auth — see its [API reference](https://github.com/RadioAnimu/animu-api/blob/main/API.md). Not yet on npm.

---

## Features

- **Live radio streaming** with selectable bitrate — 320 kbps MP3, 192 kbps MP3, and 64 kbps AAC+. Available streams are discovered dynamically at startup from `stream.animu.moe`, with a hardcoded fallback list when the endpoint is unreachable.
- **Real-time station metadata** — the app polls the station API and keeps the UI in sync with the server-side track, cover artwork, live program, DJ, and live listener count.
- **True now-playing in the system media session** — title, artist, anime, artwork, and *real track progress* are pushed to the native notification on both platforms, including for ICY/live streams where the player's internal position is stream-time rather than track-time (see [Engineering notes](#key-engineering-decisions)).
- **Background playback** — audio continues with the screen locked via a foreground service (Android) and background audio mode (iOS).
- **Music requests** — search a requestable catalog and submit a request to the station's queue, with a full form-feedback flow (success/error states) and duplicate-submission guards.
- **Live request / shout-out submissions** — validated form (name, city, artist, music, anime, message) submitted to the DJ panel.
- **Discord OAuth 2.0 sign-in** — PKCE-based authorization flow through `expo-auth-session`, token exchanged on the Animu backend, and a session that is silently re-validated on a background heartbeat; sessions are persisted and restored on launch.
- **Track history** — last requested and last played lists, deduplicated and merged incrementally.
- **Full localization** — Portuguese, English, Spanish, and Japanese, covering both UI strings and localized artwork.
- **Offline resilience** — exponential-backoff retries on API failures and graceful fallbacks for stream discovery.

## Architecture

The codebase follows a **clean, layered architecture** that keeps the UI decoupled from external systems:

| Layer | Location | Responsibility |
| --- | --- | --- |
| **Domain** | `src/core/domain` | Thin re-exports of the `animu-api` entities (`Track`, `Stream`, `Listeners`, `User`…) and its pure helpers (track-progress math, filler filtering) — one import path, no app-side duplication. |
| **Player core** | `src/core/player` | The playback engine — small, focused units composed by a thin orchestrator (see below). |
| **Services** | `src/core/services` | Application orchestration — auth, music/live requests, background tasks, and user settings. |
| **Data** | `packages/animu-api` | The `animu-api` submodule owns all HTTP, wire DTOs and DTO→domain mapping (see its [API reference](https://github.com/RadioAnimu/animu-api/blob/main/API.md)). |
| **UI** | `src/screens`, `src/components` | React Native screens and reusable components, driven by React contexts and external stores. |

The player core (`src/core/player`) decomposes playback into small, testable units composed by a **thin orchestrator** (`PlayerService`) that owns no playback or data logic itself — it only routes events between units and is the single writer of the React stores:

| Unit | Responsibility |
| --- | --- |
| `AudioTransport` | Native player + audio-session lifecycle (create/replace/resume/pause, status events) |
| `TransportStateMachine` | Explicit play-intent lifecycle (`idle → connecting → playing/paused/reconnecting`) |
| `BackoffScheduler` | Reusable exponential-backoff timer (stream reconnects + data retries) |
| `NowPlayingRepository` | On-air data: parallel fetch, diffing merge, predictive track-end refresh, error backoff |
| `MediaSessionPublisher` | Pushes now-playing metadata/status/position to the OS media session |
| `ProgressTicker` | 1 Hz heartbeat — progress store updates, track-end detection, native position push |
| `StreamPreferences` | Persisted stream-quality choice with corrupt-storage safety |
| `NetworkMonitor` | Offline → online transitions for instant reconnect + data refresh |

The units communicate through narrow, constructor-injected dependencies (a `Timer` abstraction replaces raw `setTimeout`, fetchers and connectivity subscriptions are injectable), which makes everything but the thin native seams unit-testable with plain fakes — see `src/core/player/__tests__`.

Snapshot state reaches React through **three external stores split by change cadence** (all built on `useSyncExternalStore` with shallow-equality diffing), so components opt into the granularity they need — a listener-count poll never re-renders the now-playing UI, and a 1 Hz progress tick never re-renders anything but progress:

| Store | Snapshot | Cadence | Consumed via |
| --- | --- | --- | --- |
| `playerStore` | current track/program/stream, stream options, `isPlaying`, `isInitialized` | per song / per action | `usePlayer()` |
| `stationStore` | current listeners, request/played histories | per API poll (5s playing / 30s paused) | `useStation()` |
| `progressStore` | track progress, `showProgress` | every 1s | `useTrackProgress()` |

```
src/
├── api/                  # Endpoint configuration
├── components/           # Reusable UI (player, modals, drawer, dialogs…)
├── contexts/             # Player, Auth, UserSettings, Alert, Portal providers
├── core/
│   ├── domain/           # Thin re-exports of animu-api entities + helpers
│   ├── errors/           # Typed HTTP errors
│   ├── player/           # Playback engine (transport, repository, orchestrator…)
│   └── services/         # Auth, requests, background, settings
├── hooks/                # Shared hooks (live-request form)
├── i18n/                 # PT / EN / ES / JP dictionaries
├── routes/               # Navigation (drawer + stack)
└── screens/              # Home (player), Requests, History, Settings
```

## Key engineering decisions

- **Custom HTTP layer instead of a third-party client.** A small `fetch`-based client with `AbortController` timeouts, a 2.5 s in-memory GET cache, structured request logging, and typed `HttpRequestError`s. Removing Axios eliminated a dependency while keeping a familiar request API.
- **Predictive track-end refresh.** The client knows each track's `startTime` and `duration`, so it schedules a metadata refresh just before the track ends (`startTime + duration + buffer`) — keeping the UI ahead of the station instead of polling blindly.
- **Exponential backoff.** Consecutive API/network failures retry at 2 s → 4 s → 8 s → … capped at 30 s, resetting on the first success. Combined with the track-end scheduler, the app recovers from transient outages without user intervention.
- **Real track progress in the media session.** The radio plays server-side, so progress derives from the station's `startTime` + `duration` (`getTrackProgress` in `animu-api`), not from the player's internal position — which on ICY streams is stream time, not track time. The app pushes `durationSec` and periodically re-pushes the elapsed position to `react-native-playback-controls`, letting the OS interpolate the seek bar between snapshots.
- **Visibility-gated polling.** The app-level task runner (`background.service.ts`) re-arms each task only after the previous run settles, so a slow poll never overlaps itself. Polling follows visibility: 5s while playing (keeps the notification fresh on track changes, foreground or background), 30s while paused in the foreground, and fully suspended while paused in the background — nothing visible can change there, so polling would be pure battery/radio waste. Returning to the foreground always triggers an immediate refresh.
- **Auth that survives relaunch.** The Discord OAuth code is exchanged on the Animu backend for a `PHPSESSID`, persisted to `AsyncStorage`, validated on cold start, and re-checked every 60 s by a background task. A network hiccup never logs the user out.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | React Native 0.81 · React 19 (New Architecture) |
| Build tooling | Expo SDK 54 · EAS Build |
| Language | TypeScript 5.9 (strict) |
| Navigation | React Navigation (drawer + native stack) |
| Audio | `expo-audio` · `react-native-playback-controls` (media session) |
| Auth | `expo-auth-session` (Discord OAuth 2.0 + PKCE) |
| State | React Context · custom external stores (`useSyncExternalStore`) |
| Storage | `@react-native-async-storage/async-storage` |
| Networking | Native `fetch` + `AbortController` |
| API client | `animu-api` submodule (zod-validated DTOs) |
| Background | JS task runner gated by app visibility (see engineering notes) |
| i18n | Custom dictionary-based localization (PT/EN/ES/JP) |

## Getting started

### Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/more/create-expo/) and an Expo account (for EAS)
- Android Studio / Xcode toolchains for native builds
- A device or emulator. The app targets a live station backend, so most features require network access to `animu.com.br` / `animu.moe`.

### Install & run

```bash
git clone --recurse-submodules https://github.com/RadioAnimu/animu-mobile-app.git
# already cloned? git submodule update --init
npm install        # applies the native patches via postinstall
npm run start      # Expo dev client
npm run android    # build & run on Android
npm run ios        # build & run on iOS
```

> This project uses a development client (`expo start --dev-client`) rather than Expo Go, because it depends on native modules (`react-native-track-player`, `react-native-background-timer`) and the custom native patch.

## Build & release

Builds are managed with [EAS Build](https://docs.expo.dev/build/introduction/) (see `eas.json`):

```bash
eas build --profile development   # dev client (internal)
eas build --profile preview       # internal APK / Release simulator build
eas build --profile production    # Play Store AAB (auto-incremented version)
```

Release artifacts are submitted through `eas submit` and published to the Google Play Store (`com.nessjs.animu`).

## API surface

All station endpoints are wrapped by the [`animu-api`](https://github.com/RadioAnimu/animu-api) client submodule — full schemas and business rules in its [API reference](https://github.com/RadioAnimu/animu-api/blob/main/API.md):

| Endpoint | Purpose |
| --- | --- |
| `api.animu.com.br` | Current track + artwork + listener count |
| `www.animu.com.br/teste/locutor.php` | Live program / DJ information |
| `www.animu.com.br/teste/ultimospedidos_json.php` | Last requested tracks |
| `www.animu.com.br/teste/ultimasmusicas_json.php` | Last played tracks |
| `www.animu.com.br/teste/requestSearchTest.php` | Music request search |
| `www.animu.com.br/teste/sistemaPedidos/pedirquatro.php` | Music request submission |
| `stream.animu.moe/?json=1` | Available stream endpoints (`/320`, `/192`, `/64`) |
| `www.animu.com.br/paineldj/…/request/salvar.php` | Live request / shout-out submission |
| `www.animu.com.br/teste/exchange-token.php` | Discord OAuth token exchange |
| `www.animu.com.br/teste/chatIsThisReal.php` · `byeChat.php` | Session validation / logout |

## Roadmap

- [ ] iOS release on the App Store
- [ ] Cover-art quality preference per view (already configurable server-side, wiring in progress)
- [ ] Push notifications for program/live events
- [ ] Expanded localization coverage

## License

[MIT](LICENSE) © 2023 RadioAnimu.

Rádio Animu is a non-profit community project; all artwork belongs to its respective creators and studios.