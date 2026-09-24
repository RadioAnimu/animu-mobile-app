# API Surface

The app talks to the station through the standalone
[`animu-api`](https://github.com/RadioAnimu/animu-api) TypeScript client, consumed
here as a git submodule at `packages/animu-api`. The package owns all HTTP, wire
DTOs, valibot schemas and DTO→domain mapping; the app only keeps UI-facing URLs in
`src/api/index.ts`.

Full schemas and business rules: [`animu-api` API reference](https://github.com/RadioAnimu/animu-api/blob/main/API.md).

## Station endpoints

| Endpoint | Purpose |
| --- | --- |
| `api.animu.moe` | Current track + artwork + listener count (also realtime SSE) |
| `www.animu.moe/teste/locutor.php` | Live program / DJ information |
| `www.animu.moe/teste/ultimospedidos_json.php` | Last requested tracks |
| `www.animu.moe/teste/ultimasmusicas_json.php` | Last played tracks |
| `www.animu.moe/teste/requestSearchTest.php` | Music request search |
| `www.animu.moe/teste/sistemaPedidos/pedirquatro.php` | Music request submission |
| `stream.animu.moe/?json=1` | Available stream endpoints (`/320`, `/192`, `/64`) |
| `www.animu.moe/paineldj/…/request/salvar.php` | Live request / shout-out submission |
| `www.animu.moe/teste/login_system_project` | **Auth API v5** (`/api/v5/*`) — providers, token exchange, native login, profile, provider linking, avatar, account deletion |
| `www.animu.moe/teste/exchange-token.php` · `chatIsThisReal.php` · `byeChat.php` | Legacy Discord OAuth exchange / session validation / logout |

## Realtime (SSE)

`animu.live` consumes the station's realtime Server-Sent Events stream
(`https://api.animu.moe/tungtungtung/`) — no polling. The first subscriber opens
one shared connection; drops reconnect automatically with capped exponential
backoff. Late subscribers immediately receive the last known song and listener
count.

```ts
const stop = animu.live.subscribe({
  onSongChange: ({ track, listeners, status, album }) =>
    console.log(track?.title, listeners.value, status),
  onListeners: (listeners) => console.log("listeners:", listeners.value),
  onError: (error) => console.warn(error),
});

stop.close();
```

## Auth API v5

Multi-provider OAuth (Discord, Google, Fluxer, Apple), Animu Connect
(passwordless email codes) and profile management. Reachable as `animu.auth`.

```ts
const auth = new AnimuAuth();

const providers = await auth.getProviders();
const { user, sessionToken } = await auth.exchangeToken({ provider: "discord", code, redirectUri });
const profile = await auth.getProfile();            // reuses the stored sessionToken
await auth.requestEmailLoginCode("meu@email.com");  // email → 4-digit code
await auth.verifyEmailLoginCode({ email, code: "1234" });
await auth.uploadAvatar({ avatar, filename });
await auth.deleteAccount();
```

Native **Sign in with Apple** posts the SDK's RS256 `identityToken` (no
`redirectUri`); forward the name fields since Apple only sends them on first
consent. Discord, Google, Fluxer and Apple can also log in fully server-side via
`auth.mobileStartUrl(provider)` + `auth.completeMobileAuth(url)`.

## Errors

- `AnimuApiError` — network and HTTP failures. Inspect `.statusCode`, `.url`,
  `.method`, `.code`.
- `ValidationError` — payload failed schema validation, or input was rejected
  before any network call.
- `submitMusicRequest` reports business errors as data (`RequestResult`), not
  throws: `PEDIBLOCK`, `ANIBLOCK`, `ARTISTBLOCK`, `COVERBLOCK`, `HARUBLOCK`,
  `STRIKE_AND_OUT`, `ONAIR`, `BLOCOBLOCK`, `NOLOGIN`, `NO2FA`,
  `PANEL_UNAVAILABLE`, `REQUEST_ERROR`.

## App-level URLs

`src/api/index.ts` holds only the URLs the UI links to directly — website,
requests, Discord, privacy policy, content/source licences, socials, GitHub and
the in-app legal documents — plus the `Program` type used by the i18n program
tables.
