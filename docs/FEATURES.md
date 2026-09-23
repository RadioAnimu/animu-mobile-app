# Features

A complete walk-through of what the app does, grouped by capability. Each
section lists the screen(s) involved and a **screenshot placeholder** describing
exactly what to capture.

> Screenshot convention: `![alt](SCREENSHOT: what to capture)`. See the
> [docs index](README.md#screenshot-placeholders).

## Live radio playback

The Home screen is the player: cover art, animated wordmark, live program/DJ,
listener count, remaining time and the stream-quality selector.

- **Selectable bitrate** — 320 kbps MP3, 192 kbps MP3 and 64 kbps AAC+.
  Available streams are discovered at startup from `stream.animu.moe` with a
  hardcoded fallback list when the endpoint is unreachable.
- **Real-time station metadata** — the app keeps the UI in sync with the
  server-side track, cover artwork, live program, DJ and listener count,
  preferring the station's realtime SSE stream and falling back to HTTP polling.
- **Background playback** — audio continues with the screen locked via an
  Android foreground service and the iOS background-audio mode.
- **Track progress** — remaining time is derived from the station's
  `startTime` + `duration`, so it is accurate on ICY/live streams.

![Home player](SCREENSHOT: Home screen mid-song — animated wordmark, live program + DJ, artwork, remaining time, NO AR/song title/artist, and the three bitrate buttons)

## System media session

The **anime as the title**, the artist, the cover artwork and **real track
progress** are pushed to the native media session on both platforms — lock
screen, notification shade and the OS media controls. Progress is interpolated
by the OS between snapshots (`durationSec` + periodic elapsed position).

![Now playing notification](SCREENSHOT: Android media notification and iOS lock-screen player showing the anime title, artist and a progress bar mid-track)

## Home audio visualizer (Android)

An oscilloscope fed by the player's own decoded PCM through a patched
`expo-audio` ExoPlayer tap, rendered by the **web player's own canvas loop** in
a transparent `react-native-webview` (Canvas 2D + `requestAnimationFrame`) —
**no microphone permission** and no second audio stream. The line is delayed to
match the audible output and auto-calibrates its sync; the WebView unmounts
while backgrounded. On iOS the row is omitted and the whole
implementation is platform-split out of the iOS bundle (the expo-audio
`MTAudioProcessingTap` hook installs but its callback never fires for indefinite
HTTP audio).

![Android visualizer](SCREENSHOT: Android Home screen with the oscilloscope visible above the player controls, captured while playing)

## Authentication

Multi-provider sign-in exchanging for a session on the Animu backend. The
OAuth providers are **server-mode**: the app opens the backend's
`/mobile/<provider>-start.php` in a browser session and adopts the session token
the server bounces to `animuapp://redirect` — no client ids, SDKs or signing
registration app-side (the backend owns the OAuth client + PKCE).

- **Discord**, **Google** and **Fluxer** — server-side browser redirect.
- **Apple** — native Sign in with Apple sheet on iOS, server redirect on Android.
- **Animu Connect** — passwordless email codes (not OAuth).

Sessions persist to the device keychain and are rehydrated on cold start, so a
network hiccup never logs you out.

![Login screen](SCREENSHOT: Login screen listing the provider buttons — Apple, Google, Discord (and Fluxer when the backend advertises it) plus the Animu Connect email field)

![Animu Connect code](SCREENSHOT: Animu Connect step showing the 4-digit email code inputs and the resend countdown)

## Account management

Previewed from the drawer identity chip: banner, avatar, linked-provider icons,
Animu Connect email management and account deletion. Avatar changes bump an
`imageVersion` to bust the image cache.

![Account screen](SCREENSHOT: Account screen with profile banner, avatar, display name, linked provider icons and the account action rows)

![Drawer](SCREENSHOT: Open navigation drawer — wordmark, MENU items (Player, Últimas Pedidas, Últimas Tocadas, Fazer Pedido) and the signed-in identity chip at the bottom)

## Music requests

Search the requestable catalog and submit to the station queue, with full
feedback states and duplicate-submission guards. Business rules (blocks,
on-air status, login requirements) are returned as data, not thrown.

![Make a request](SCREENSHOT: Make Request screen with a search query, result list showing covers and the submit button in its ready state)

## Live requests / shout-outs

A validated form (name, city, artist, music, anime, message) delivered privately
to the DJ panel and posted to the station's Discord. No public feed, no
user-to-user messaging.

![Live request sheet](SCREENSHOT: Live request bottom sheet filled in with an example shout-out and the send button)

## Track history

Last requested and last played lists, deduplicated and merged incrementally,
with a per-screen cover-art toggle.

![Last requested](SCREENSHOT: Últimas Pedidas list — each row with cover thumbnail, "Artist - Track | Anime" title and duration)

![Last played](SCREENSHOT: Últimas Tocadas list in the same layout as Últimas Pedidas)

## Preferences & localisation

Per-view cover-art quality (`off` / `low` / `medium` / `high`), history/search
cover toggles, language selection and an OTA-update section — all persisted
locally. UI and artwork are localised in **Portuguese, English, Spanish and
Japanese**.

![Settings](SCREENSHOT: Settings screen showing the section list — Account, Behavior, Updates, Cover data, Storage, Links, Legal, Reset and About)

![Storage](SCREENSHOT: Storage screen with the cover-cache partitions, sizes and the per-partition clear actions)

## Polished UX & resilience

- Tokenized theme (`src/theme`), animated drawer, bottom sheets, toasts.
- Marquee titles with tap-to-copy.
- Error boundary and offline resilience: exponential-backoff retries on API
  failures and graceful stream-discovery fallbacks.
- Visibility-gated polling — 5s foreground playing, 30s foreground paused, 30s
  background playing, 60s background paused.

![Toast](SCREENSHOT: A tap-to-copy toast appearing after long-pressing a song title)
