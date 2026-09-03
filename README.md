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

> **📦 [`animu-api`](https://github.com/RadioAnimu/animu-api)** — the radio's TypeScript API client lives in its own repository ([npm](https://www.npmjs.com/package/animu-api)). It powers this app's entire data layer (now playing, programs, history, requests, streams, auth) and is developed at [`packages/animu-api`](packages/animu-api) in this monorepo.

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
| **Domain** | `src/core/domain` | Framework-free entities (`Track`, `Program`, `Stream`, `Listeners`, `LiveRequest`, `User`) and business rules such as track-progress math and form validation. |
| **Services** | `src/core/services` | Application orchestration — the player engine, auth, music/live requests, background tasks, and user settings. |
| **Data** | `src/data` | HTTP clients (`data/http`), wire DTOs (`data/http/dto`), and mappers (`data/mappers`) that translate DTOs into domain models. |
| **UI** | `src/screens`, `src/components` | React Native screens and reusable components, driven by React contexts and external stores. |

The player core is a **singleton service** (`playerService()`) that owns all mutable state and exposes it through **snapshot-based external stores** (`playerStore`, `progressStore`) built on `useSyncExternalStore` with shallow-equality diffing — so components only re-render when the state actually changes, and every subscriber always reads a consistent snapshot.

```
src/
├── api/                  # Endpoint configuration
├── components/           # Reusable UI (player, modals, drawer, dialogs…)
├── contexts/             # Player, Auth, UserSettings, Alert, Portal providers
├── core/
│   ├── domain/           # Entities + validation
│   ├── errors/           # Typed HTTP errors
│   └── services/         # Player, auth, requests, background, settings
├── data/
│   ├── http/             # API clients + axios-equivalent fetch client
│   │   └── dto/          # Wire-format types
│   └── mappers/          # DTO → domain mapping
├── hooks/                # Shared hooks (live-request form)
├── i18n/                 # PT / EN / ES / JP dictionaries
├── routes/               # Navigation (drawer + stack)
└── screens/              # Home (player), Requests, History, Settings
```

## Key engineering decisions

- **Custom HTTP layer instead of a third-party client.** A small `fetch`-based client with `AbortController` timeouts, a 2.5 s in-memory GET cache, structured request logging, and typed `HttpRequestError`s. Removing Axios eliminated a dependency while keeping a familiar request API.
- **Predictive track-end refresh.** The client knows each track's `startTime` and `duration`, so it schedules a metadata refresh just before the track ends (`startTime + duration + buffer`) — keeping the UI ahead of the station instead of polling blindly.
- **Exponential backoff.** Consecutive API/network failures retry at 2 s → 4 s → 8 s → … capped at 30 s, resetting on the first success. Combined with the track-end scheduler, the app recovers from transient outages without user intervention.
- **Native patch for live-stream progress.** Internet-radio (ICY) streams break `react-native-track-player`'s progress reporting, because ExoPlayer's position is stream time, not track time. The repo ships a `patch-package` patch (`patches/react-native-track-player+4.1.2.patch`) that plumbs `elapsedTime`/`duration` through `MusicModule` and overrides the `PlaybackStateCompat` position in the Android `MediaSession` — so the notification shows the *real* track progress.
- **Platform-aware background timing.** One-shot timers and intervals use `react-native-background-timer` on Android and standard `setInterval` on iOS, where the background-audio service already owns the process.
- **Auth that survives relaunch.** The Discord OAuth code is exchanged on the Animu backend for a `PHPSESSID`, persisted to `AsyncStorage`, validated on cold start, and re-checked every 60 s by a background task. A network hiccup never logs the user out.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | React Native 0.79 · React 19 |
| Build tooling | Expo SDK 53 · EAS Build |
| Language | TypeScript 5.8 (strict) |
| Navigation | React Navigation (drawer + native stack) |
| Audio | `react-native-track-player` (patched) · `expo-web-browser` |
| Auth | `expo-auth-session` (Discord OAuth 2.0 + PKCE) |
| State | React Context · custom external stores (`useSyncExternalStore`) |
| Storage | `@react-native-async-storage/async-storage` |
| Networking | Native `fetch` + `AbortController` |
| Background | `react-native-background-timer` |
| Patching | `patch-package` |
| i18n | Custom dictionary-based localization (PT/EN/ES/JP) |

## Getting started

### Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/more/create-expo/) and an Expo account (for EAS)
- Android Studio / Xcode toolchains for native builds
- A device or emulator. The app targets a live station backend, so most features require network access to `animu.com.br` / `animu.moe`.

### Install & run

```bash
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

The app consumes the public Animu endpoints (`src/api/index.ts`):

| Endpoint | Purpose |
| --- | --- |
| `api.animu.com.br` | Current track + artwork + listener count |
| `www.animu.com.br/teste/locutor.php` | Live program / DJ information |
| `www.animu.com.br/teste/ultimospedidas_json.php` | Last requested tracks |
| `www.animu.com.br/teste/ultimasmusicas_json.php` | Last played tracks |
| `www.animu.com.br/teste/requestSearchTest.php` | Music request search / submission |
| `stream.animu.moe/?json=1` | Available stream endpoints (`/320`, `/192`, `/64`) |
| `www.animu.com.br/paineldj/…/request/salvar.php` | Live request / shout-out submission |
| `www.animu.com.br/teste/exchange-token.php` | Discord OAuth token exchange |

## Roadmap

- [ ] iOS release on the App Store
- [ ] Cover-art quality preference per view (already configurable server-side, wiring in progress)
- [ ] Push notifications for program/live events
- [ ] Expanded localization coverage

## License

[MIT](LICENSE) © 2023 RadioAnimu.

Rádio Animu is a non-profit community project; all artwork belongs to its respective creators and studios.