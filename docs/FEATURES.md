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

## Home audio visualizer

An oscilloscope fed by the player's own decoded audio (react-native-anything-player's
`audioSample` windows), rendered by the **web player's own canvas loop** in a
transparent `react-native-webview` (Canvas 2D + `requestAnimationFrame`) —
**no microphone permission** and no second audio stream. The line matches the
audible output and auto-calibrates its sync; the WebView unmounts while
backgrounded. Available on iOS too: AVPlayer never taps HTTP streams, so the
player decodes the stream's bytes in parallel and releases each window when it
is heard.

![Android visualizer](SCREENSHOT: Android Home screen with the oscilloscope visible above the player controls, captured while playing)

## Synced lyrics

The lyrics button in the cover's corner opens a full-screen, Apple Music-style
lyrics view of the song being **heard** (not the one the station announced):

- **Synced to the speaker** — the active line follows the player's audible
  clock (ICY title changes, the measured stream lag), sampled 4× a second and
  advanced every frame on the UI thread. A line lights up 150 ms before its
  stamp; while the position is still being measured the header reads
  "Syntonizing…" and no line is lit.
- **The Apple Music read** — large bold lines, the active one lit and followed
  in the upper third; each change ripples down the list (rows further below
  start later), with breathing dots through the intro and instrumental breaks.
  Lyrics with real word timing (enhanced LRC) fill word by word; line-synced
  lyrics light whole lines — word times are never guessed. Lines further from
  the lit one fade and blur (blur on Android 12+; iOS keeps view blur behind
  an experimental React Native flag, so there it is the fade alone). Dragging
  browses; the view returns to the song 3 s later or on a tap. Swipe down on
  the header (or tap the grabber) to close.
- **The right version** — lyrics come from [LRCLIB](https://lrclib.net). Every
  row is checked against the station's title, artist, anime and the length of
  the cut on air: TV-size, full and live cuts differ, so lyrics timed for
  another cut are shown untimed (with a note), and instrumental, karaoke and
  other-language versions are rejected; among equals, the original Japanese
  script wins over a romaji upload. Lookups are cached (found: 30 days,
  not found: 12 hours); while the view is open, the next announced song is
  looked up before it is heard.
- **Romaji / hiragana** — Japanese lines can show their romaji or hiragana
  reading underneath (Settings → Lyrics, or the "Aa" button), from two
  sources:
  - **Human romaji** — LRCLIB often has a song twice, in Japanese and in
    romaji. Lines that start together are paired (and only when the romaji
    actually spells the Japanese line's kana, so translations are rejected).
    No download; about a third of the station's Japanese songs.
  - **The Japanese dictionary** (opt-in) — kuromoji + IPADIC: kanji readings
    for every line, hiragana mode, and kanji titles matching the station's
    romaji (新時代 ↔ Shin Jidai). 17.8 MB download from jsDelivr/unpkg,
    verified file by file (size + MD5 of the published package), unpacked
    once in small steps (~20 s, the app stays responsive) and stored without
    its zero padding: 62 MB on the device. While lyrics are open its reader
    is built (~3 s, after the screen settles) and holds ~90 MB; it is
    released when they close.
- **Accessible** — Reduce Motion drops the ripple and the drifting backdrop;
  with a screen reader the lyrics become a plain list with the current line
  marked.

Only the station's song names are sent to LRCLIB (no account, a neutral
User-Agent without device details).

![Lyrics](SCREENSHOT: the lyrics view mid-song — blurred cover backdrop, the active line lit with the next lines dimmed below, romaji under a Japanese line)

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
cover toggles and language selection — all persisted
locally. UI and artwork are localised in **Portuguese, English, Spanish and
Japanese**.

![Settings](SCREENSHOT: Settings screen showing the section list — Account, Behavior, Cover data, Storage, Links, Legal, Reset and About)

![Storage](SCREENSHOT: Storage screen with the cover-cache partitions, sizes and the per-partition clear actions)

## Polished UX & resilience

- Tokenized theme (`src/theme`), animated drawer, bottom sheets, toasts.
- Marquee titles with tap-to-copy.
- Error boundary and offline resilience: exponential-backoff retries on API
  failures and graceful stream-discovery fallbacks.
- Visibility-gated polling — 5s foreground playing, 30s foreground paused, 30s
  background playing, 60s background paused.

![Toast](SCREENSHOT: A tap-to-copy toast appearing after long-pressing a song title)
