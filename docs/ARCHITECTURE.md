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

Playback runs on **[react-native-anything-player](https://github.com/rmotafreitas/react-native-anything-player)**,
a native-first player: its native engine owns the state machine, reconnects,
stall / dead-socket / network recovery, live-edge resumes, audio focus,
interruptions, the lock screen and remote commands, and background keepalive.
None of that runs in JS any more, so it keeps working while JS timers are
frozen.

`src/core/player` adds what only the app knows:

| Module | Responsibility |
| --- | --- |
| `player-service.ts` (`PlayerService`) | Which stream to play, commands, store writes, lock-screen metadata; follows Anything Player's status |
| `stream-playback/now-hearing.ts` (`NowHearing`) | What the listener is **hearing** and how far into it (see below) |
| `stream-playback/heard-track.ts` (`HeardTrack`) | The ICY source: titles as they play, tune-in calibration |
| `stream-playback/stream-sync.ts`, `audible-track.ts` | The audible clock and the track on it (fallback without ICY) |
| `stream-playback/now-playing.repository.ts` (`NowPlayingRepository`) | On-air data: realtime SSE + HTTP fallback, diffing merge, history, listeners, error backoff (`backoff.ts`) |
| `stream-playback/stream-preferences.ts` | Persisted stream-quality choice |
| `visualizer/audio-sampler.ts` (`AudioSampler`) | Oscilloscope windows from Anything Player's `audioSample` events (pacing, delay, draw gain) |
| `media-session/now-playing.metadata.ts` | Pure mapper: track → lock-screen fields (anime as title, cover, duration) |
| `storage/` | Cover resolution, disk/image caches and the bundled default |
| `artwork-prefetch.ts` | Warms an announced track's cover before it is heard |
| `player-factory.ts` | Composition root and the `playerService()` singleton |
| `store.ts` | The three external stores and the UI's `TransportState` |
| `ports.ts` | The slice of Anything Player's `Player` the core uses (faked in tests) |

### What is heard: ICY titles, with the audible clock behind them

`NowHearing` answers "what is the listener hearing, and how far into it?"
from two independent sources.

**ICY titles (`HeardTrack`) are the truth at every song change.** The ICY
title is exactly the API's `rawtitle` and changes about 1.2 s after its
`timestart` (67 changes over 3 hours, 0.34–1.85 s). Anything Player reports
each title **when it plays** (iOS: AVPlayer's metadata output, measured on the
64 kbps mount: 16.4–17.1 s after the title arrived, its buffer; Android:
Media3's metadata renderer, within 0.04 s of where the title sits in the
stream).

**Matching a heard title.** A title is heard a stream lag after the station
announced its item, so by then the station is often past it: every jingle
shorter than the lag (the 4–5 s request jingle on any mount, nearly all of
them at 64 kbps's 17 s) is already replaced. `HeardTrack` matches against the
current track, the repository's recent on-air items (filler included, with
their timing) and the played history — exactly first, then ignoring Unicode
form, case, spacing and escaped quotes. A title nothing names is shown as
itself and forces the HTTP metadata leg: the live stream evidently missed the
item (the daemon silently skips slow clients). When a title never arrives at
all, the station's item takes over once it has been audible
`ICY_OVERDUE_MS` (30 s) and the heard one is over — a title the station never
named counts as over once it announced a later item — so the display can never
stay behind for a whole song.

Where a title sits in the *audio* depends on the mount. The station writes it
at the item's first audio, but Icecast only sends metadata every
`icy-metaint` = 16000 bytes, counted from each connection's own start. So a
title is heard 0–1 block into its item, uniformly: a block is 0.4 s at
320 kbps, 0.67 s at 192 and 2 s at 64. Recording the three mounts at once and
cross-correlating their decoded audio (11 changes, 2026-10-11) puts the 192
titles 0.14 s and the 64 titles 0.69 s after 320's on average (the half-block
model predicts 0.13 / 0.80), and on 320 the jingles start 0–0.2 s before their
titles. So a title change means "this track started half a block ago, here"
(`icyTitleInItemMs`: 0.2 s on 320, 0.33 s on 192, 1 s on 64), give or take
half a block. Every mount used to assume 1.2 s, the station's timeline
rather than the audio's: lyrics ran 1 s early on 320, and on 64 the ±1 s
spread sometimes put them late. The lyrics view lights the line on the other
side of a near change too, which covers that spread.

The one computed position is a **tune-in** (first title after opening,
switching stream or a live-edge resume). The title says which song, but it is
already partway: its position is station time minus how far the speaker trails
the live edge, with a server clock correction from HTTP `date` headers when
the device clock is grossly wrong. That lag is taken from the audible clock
once it has settled (1 Hz readings, a few seconds of "calculating"), not from
the moment the first title plays. The first title plays at once, while the
connect burst is still loading: 1.6 s of audio on 320, 7 s on 192, 17 s on
64. A reading taken then was the 192 / 64 kbps regression: Android had 4.8 s
buffered of the 17 s actually behind the edge, and iOS `loadedTimeRanges` read
11.6 s (Anything Player now measures the iOS live offset from what its stream proxy
handed the player). Each title change heard afterwards shows how far the
tune-in computation was off on this stream. The median of the last 9 corrects
the next tune-in. Before the first change it starts from the station clock's
lead over its audio (`STATION_AHEAD_OF_AUDIO_MS`, 1 s: the title changes
1.2 s after `timestart` and is heard 0.2 s into the item on 320).

Measured after the fix (2026-10-05, tune-in vs the next heard change, which
carries the station's own ±1 s `timestart` jitter): 64 kbps 0.9 s on iOS and
Android (before: 5.6 s and 16 s), 192 kbps 0.3 s on iOS.

**The audible clock (`StreamSyncEngine` + `AudibleTrackResolver`)** is the
pre-ICY model: wall clock minus the measured lag, smoothed. The station's
track shows once the clock reaches its start. It drives the display when a
stream carries no ICY titles (12 s of playback without one), so the app never
depends on one source alone. It is fed by Anything Player's `progress` events: 1 Hz
readings from a native timer while playing, which also pump its boundary
timer on Android, where JS timers do not run in the background.

**Once settled, the audible clock is locked.** The lag readings jitter with
network delivery (the forward buffer saw-tooths as chunks land), but while
audio plays without a stall the real lag cannot change. So the settled estimate
becomes a fixed wall-clock offset, and every computed position (a tune-in, or
the clock without ICY) advances in true seconds from it. Before the lock, the
position followed every reading, so seconds stretched, shrank or repeated, and
the bar jumped after "synchronizing". The lag only really changes when audio
stops: a pause or stall holds the clock and adds that time to the lag, and a
re-open measures again. The readings can only under-read the lag (the player
cannot hold audio the station has not sent), so the lock moves only when they
stay 2 s or more above it for 5 readings in a row. That happens when the lock
was taken while the connect burst was still loading.

**One position, extrapolated everywhere.** `NowHearing.position()` is the
position as a fixed point: elapsed ms at a wall-clock instant, advancing while
audio flows. A heard title anchors it at the change, and a computed one comes
off the locked clock. It only changes at real events (a title, the lock, pause
or resume, a re-open). The UI extrapolates it the same way the lock screen
does natively. The header bar runs one linear native animation to the song's
end, and the countdown re-renders exactly at each second boundary. Nothing is
eased or polled, so the bar, the countdown, the lyrics and the lock screen
all show the same position.

Measured on the Android emulator (2026-10-12, 64 kbps, the position compared
with the player's media position every second): 36 lyrics open / close
cycles and backgrounds of 15 s to 4 min left it within 0.01 s. Two things
did move it, and both are handled now.

**A connection replaced under the source.** When a connection drops, Android
plays on into a fresh one and iOS's stream proxy splices a fresh upstream into
the same response, both with no state change. A fresh Icecast connection
starts with the server's burst of recent audio, so the audio jumps back by up
to the burst (16 s on 64 kbps, 1.6 s on 320) less the outage. Anything Player
reports it as a `discontinuity` event once the jump is audible (Android: the
position discontinuity onto the new connection; iOS: the playhead reaching
the splice). `PlayerService` then places the song again like after a
re-open, from the audible clock, which re-measures the lag on the new
connection. The same title is not reported again, so the track already shown
is re-heard as a tune-in.

**Timing that depends on the JS thread.** Play and stall transitions are
handled in JS, so a busy JS thread used to shift the position by the delay.
Every progress reading now carries the player's media position, which only
advances with the audio: the heard position (`HeardTrack.alignToMedia`) and
the locked clock (`StreamSyncEngine.alignToMedia`) take the first reading
after they are placed as a reference and follow the media clock from there,
moved onto it when more than 60 ms off (the readings agree to ±6 ms; a
pause or resume handled a beat late used to leave ~0.1 s). The biggest source of JS stalls was
the Japanese dictionary's reader, rebuilt on every lyrics open (12 s of JS on
the emulator) with quick reopens stacking builds; it is now kept for a minute
after the lyrics close (`READER_KEEP_MS`). Opening the lyrics still costs
0.5–1 s of JS in a debug build on the emulator (rendering the rows), but that
no longer moves the position.

The lock screen gets `updateNowPlaying({ …, duration, elapsed })`; Anything Player
advances the song's progress natively, only while audio plays. No JS timer is
involved, which matters on Android: React Native fires no JS timers while the
activity is backgrounded, but native events (ICY titles, status) still run JS.

Play from Control Center when nothing is loaded: iOS relaunches the app in the
background when Play is pressed for a terminated Now Playing app. Anything Player
registers the system controls as soon as the player exists. A `play` that
finds nothing loaded is forwarded to JS as a `remoteCommand`, and
`PlayerService` opens the stream. A suspended app's player is still loaded,
so Anything Player resumes it natively.

## Lyrics

`src/core/lyrics` shows the heard song's lyrics; `src/core/japanese` adds the
opt-in reading dictionary. Both follow the player core's discipline: ports,
constructor-injected units, a composition root, external stores.

| Module | Responsibility |
| --- | --- |
| `lyrics-service.ts` (`LyricsService`) | Lookups for the shown song (memory → disk → LRCLIB), shared between callers, never emitted for a song no longer shown; prefetch of the announced song only while lyrics are on screen |
| `matcher.ts`, `text.ts` | Validating provider rows: title/artist identity (script, width, name order, bracketed titles, `(CV: …)`), version conflicts (instrumental, language, live), and whether the timing fits the cut on air (±4 s) |
| `lrc.ts` | LRC / enhanced LRC → a timeline of lines (measured word timing only) and interludes (intro, marked or long breaks) |
| `ports.ts`, `file-cache.ts`, `src/api/lrclib.ts` | Provider and cache ports; LRCLIB client (validated rows, retries); one JSON file per song in the cache directory |
| `romaji-pair.ts` | A romaji upload of the same lines, paired by start time (a Japanese line takes the fewest romaji lines that read it) and checked against the line's kana |
| `segments.ts` | A romaji line split onto the Japanese one word by word (kana anchors, kanji runs as wildcards, memoized backtracking); segments timed from the word timing |
| `pronunciation.ts` | The reading under a line, best source first: human romaji by word, human romaji as a line, dictionary by word |
| `japanese/dictionary-manager.ts` | All-or-nothing install (verified download with watchdog, retries and mirrors, one-time unpack), cancel, removal, cleanup of interrupted installs; the reader built while lyrics are open and released after |
| `japanese/unpack.ts` | Streaming gunzip (fflate) in ~12 ms steps that yield to the event loop; trims the zero padding |
| `japanese/tokenizer.ts`, `reader.ts` | kuromoji's loader rebuilt without Node APIs from the stored files, its target maps read in steps; hiragana and word-split romaji |

**Timing.** Lyrics run on the same axis as the progress bar:
`PlayerService.heardPosition()` reads `NowHearing` (the ICY title anchor, or the
settled audible clock) on demand. `useHeardPosition` samples it at 4 Hz on the
JS thread and only re-anchors on a real change (pause, a new anchor, > 60 ms
drift); a Reanimated frame callback advances it on the UI thread, so the active
line, the word fill and the interlude dots never wait for JS. The station's
`startTime` alone would run up to a stream lag (17 s on 64 kbps) ahead of the
speaker.

**The dictionary's cost.** Pure-JS gunzip of IPADIC takes ~20 s on Hermes, so
it never runs per session: the files are unpacked once after the download (in
steps, the app stays responsive) and stored trimmed (62 MB). A session reads
them natively and builds the tokenizer around kuromoji's classes: its one
heavy step, the target maps (~1 M integers), is read in ~8 ms steps; files
read only within their data are handed over unpadded (kuromoji's padding was
20 MB of zeros in memory and ~150 000 empty character classes); labels for a
song are read in ~8 ms steps too. A test builds both loaders from the real
IPADIC and requires identical tokens. kuromoji and fflate are loaded through
dynamic imports: someone who never installs the dictionary never evaluates
them (they cost ~66 KB of bundle).

**Download.** The install is all-or-nothing: each file is downloaded with a
no-progress watchdog (20 s), retried over both mirrors with backoff
(2/5/10/20 s) — a network switch or short outage costs a retry, not the
install — verified, unpacked, stored. A failure, a cancel, or an app killed
mid-way (found at the next launch) deletes the whole directory; free space is
checked up front.

**Screen.** `src/screens/Lyrics` is a full-screen modal route. The list is not a
`FlatList`: every row knows its own offset and springs to the follow target
after a delay that grows with its distance from the active line (the ripple),
or tracks the finger while browsing (a gesture-handler pan with decay).

## State stores

Snapshot state reaches React through **three external stores split by change
cadence** (all built on `useSyncExternalStore` with shallow-equality diffing),
so components opt into the granularity they need — a listener-count poll never
re-renders the now-playing UI, and a progress re-anchor never re-renders
anything but progress:

| Store | Snapshot | Cadence | Consumed via |
| --- | --- | --- | --- |
| `playerStore` | current track/program/stream, stream options, `isPlaying`, `playbackState`, `isInitialized` | per song / per action | `usePlayer()` |
| `stationStore` | current listeners, request/played histories | per API poll (see cadence below) | `useStation()` |
| `progressStore` | progress anchor (`progressMs` at `progressAt`, `progressRunning`), `showProgress` | per re-anchor | `useTrackProgress()` |

The foreground ticker (1 Hz, only while the app is visible) re-publishes
progress (a no-op unless the anchor moved) and polls the API every **5 s** while audio is wanted and every **30 s**
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
│   ├── japanese/         # Opt-in reading dictionary (kuromoji + IPADIC)
│   ├── lyrics/           # Synced lyrics: LRCLIB lookups, matching, LRC timeline
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
  audible with its ICY title; from then on Anything Player advances the lock-screen
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
  Anything Player's. Lock-screen, headset, Bluetooth and car commands reach the native
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
  by a WebView canvas.** Anything Player streams the decoded audio as `audioSample`
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
| Audio | `react-native-anything-player` (native engine, recovery, focus/interruptions, media session, ICY at audible time, decoded-audio sampling) — vendored tarball in `vendor/` |
| Visualizer | Transparent `react-native-webview` running the web player's Canvas 2D + `requestAnimationFrame` loop, fed by Anything Player's `audioSample` windows (iOS and Android); unmounted while backgrounded (`AppStateGate` + `react-freeze`) |
| Icons | `@react-native-vector-icons/material-icons` · `react-native-svg` (only `ProviderIcon`, `SocialIcon`, `BackArrow`) |
| Images | `expo-image` (covers, avatars, localized artwork) |
| Auth | `animu-api` Auth v5 · `expo-auth-session` + `expo-web-browser` (Discord/Google OAuth 2.0 + PKCE) · `expo-apple-authentication` (Apple) |
| State | React Context · custom external stores (`useSyncExternalStore`) |
| Storage | `expo-secure-store` (session token) · `@react-native-async-storage/async-storage` (settings + profile projection) |
| Realtime | `animu-api` SSE stream (`animu.live`) with HTTP polling fallback |
| Networking | `expo/fetch` + `AbortController` |
| API client | `animu-api` submodule (valibot-validated DTOs) |
| Background | Playback and its recovery are native (Anything Player); JS task runner gated by app visibility for the rest |
| i18n | Custom dictionary-based localization (PT/EN/ES/JP) |
| Testing | Vitest (player core, services, domain, hooks, plugins) |
