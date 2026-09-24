# Animu Mobile App

> The official mobile client for [Rádio Animu](https://www.animu.moe) — Brazil's most moe radio.

[![Version](https://img.shields.io/badge/version-3.0.0-8A2BE2)](https://github.com/RadioAnimu/animu-mobile-app/releases)
[![React Native](https://img.shields.io/badge/React_Native-0.86-blue)](https://reactnative.dev)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-000000)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)](https://www.typescriptlang.org)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-3DDC84)](https://play.google.com/store/apps/details?id=com.nessjs.animu)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Founded on April 16, 2018, **Rádio Animu** is a non-profit Brazilian radio dedicated to otaku culture — anime songs, openings and endings, fansings, remixes, rhythm-game music, vocaloid and more, with a live DJ schedule, listener-driven requests and a Discord community.

This repository is the official mobile application: a real-time internet-radio client built on React Native and Expo that mirrors the live station state — current track, cover art, live program, listener count and request history — while keeping audio streaming and accurate now-playing metadata alive in the background.

- **Android** — [Google Play Store](https://play.google.com/store/apps/details?id=com.nessjs.animu) (`com.nessjs.animu`)
- **iOS** — in development · sideload via the [AltStore source](docs/ALTSTORE.md)
- **Website** — [animu.moe](https://www.animu.moe) · [animu.com.br](https://www.animu.com.br)

![Home player](SCREENSHOT: hero shot of the Home screen playing a track — wordmark, live DJ, artwork, remaining time and the bitrate selector)

![Drawer](SCREENSHOT: open navigation drawer with the menu items and the signed-in identity chip)

![Last requested](SCREENSHOT: Últimas Pedidas history list with cover thumbnails and durations)

![Make a request](SCREENSHOT: Make Request screen with a search query, results and the submit button)

![Account](SCREENSHOT: Account screen with the profile banner, avatar and linked provider icons)

> Screenshots aren't committed yet — the text inside each `()` is a brief for the
> shot to capture. See the [docs index](docs/README.md#screenshot-placeholders).

---

## Highlights

- **Live radio streaming** — selectable 320/192 kbps MP3 and 64 kbps AAC+, with dynamic stream discovery and a fallback list.
- **True now-playing everywhere** — real track progress (derived from the station's `startTime` + `duration`) pushed to the native media session, lock screen and notification, plus background playback on both platforms.
- **Android audio visualizer** — an oscilloscope fed by the player's own decoded PCM (patched `expo-audio` tap) and drawn by the web player's own canvas loop in a transparent WebView, with **no microphone permission** (iOS omits the feature).
- **Optional accounts** — Discord, Google, Apple, Fluxer and Animu Connect (passwordless email codes), with profile, avatar and provider management. Playback works anonymously.
- **Requests** — search and request tracks, and send live shout-outs to the DJ panel.
- **History & preferences** — last requested / last played lists, cover-art quality per view, and PT / EN / ES / JP localisation.
- **Offline resilience** — exponential-backoff retries, visibility-gated polling and a native background heartbeat.

Read the full, screen-by-screen breakdown in **[Features](docs/FEATURES.md)**.

## Tech stack

React Native 0.86 (New Architecture) · React 19 · Expo SDK 57 · TypeScript 6
(strict) · React Navigation 7 (drawer) · `expo-audio` +
`react-native-playback-controls` · `expo/fetch` · `react-native-webview` (visualizer)
· custom `useSyncExternalStore` stores · Vitest.
See **[Architecture](docs/ARCHITECTURE.md)** for the full picture.

## Quick start

```bash
git clone --recurse-submodules https://github.com/RadioAnimu/animu-mobile-app.git
npm install        # applies native patches and builds the animu-api submodule
npm run android    # or: npm run ios
npm test           # vitest
npm run lint       # expo lint
```

Requires Node 20+ and a device/emulator with network access to `animu.moe`. The
licensed **Proxima Nova** fonts are not committed — see
[Development](docs/DEVELOPMENT.md#fonts).

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/](docs/README.md) | Documentation index |
| [Features](docs/FEATURES.md) | Every capability, screen by screen |
| [Architecture](docs/ARCHITECTURE.md) | Layers, player core, stores, key decisions |
| [Development](docs/DEVELOPMENT.md) | Setup, scripts, tests, aliases, patches, fonts |
| [Build & Release](docs/BUILD_AND_RELEASE.md) | EAS profiles, versioning, OTA, voice assistants |
| [API Surface](docs/API_SURFACE.md) | Station endpoints and the `animu-api` submodule |
| [AltStore](docs/ALTSTORE.md) | Self-hosted iOS distribution |
| [Store Submission](docs/STORE_SUBMISSION.md) | Master checklist and data inventory |
| [App Store Review Notes](docs/APP_STORE_REVIEW_NOTES.md) | Apple review notes + App Privacy |
| [Play Store Review Notes](docs/PLAY_STORE_REVIEW_NOTES.md) | Play Data safety + content rating |
| [Third-Party Notices](docs/THIRD_PARTY_NOTICES.md) | Artwork, media and font attributions |

## Roadmap

- [ ] iOS release on the App Store
- [ ] Push notifications for program/live events
- [ ] Expanded localization coverage

## License

The app's source code is [MIT](LICENSE) © 2023 RadioAnimu. The MIT license
covers the source code only — see [NOTICE](NOTICE) for the full scope.

Rádio Animu is a non-profit community project. The station's original content is
licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Artwork and media owned by others are **not** covered by that license — see
[THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md). The bundled Proxima Nova
font is commercial and is not included in this repository. The `animu-api`
submodule is a separate MIT-licensed repository.
