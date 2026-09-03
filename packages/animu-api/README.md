# animu-api

Lightweight, bulletproof TypeScript client for the [Animu](https://www.animu.com.br) radio API. Use it in any project — servers, CLIs, bots, web apps, React Native, Electron, you name it.

- **Zero runtime dependencies** — plain `fetch`. Runs on Node ≥ 18, browsers, Deno, Bun and React Native.
- **Schema-validated boundaries** — every response is validated with [zod](https://zod.dev) (peer dependency) so malformed server payloads never leak into your code. Numeric fields arrive as strings? Coerced. A flaky PHP endpoint returns garbage? It degrades gracefully instead of crashing.
- **Hardened HTTP** — per-request timeout via `AbortController`, a 2.5s GET micro-cache that absorbs rapid polling, and a uniform `AnimuApiError` carrying `statusCode`, `url` and `method`.
- **Tree-shakeable** — side-effect free, dual ESM/CJS build with full type declarations.
- **Bring your own identity** — user agent, timeout, artwork quality, default cover and fallback streams are all configurable.

## Install

```bash
npm install animu-api zod
```

`zod >= 3.24` is the only peer dependency.

## Quick start

```ts
import { AnimuApi } from "animu-api";

const animu = new AnimuApi();

// Now playing + listeners (single API call)
const { track, listeners } = await animu.getStreamMetadata();
track?.title;    // "Philosophyz"
track?.anime;    // parsed from the raw title ("Now Playing" if absent)
track?.artwork;  // quality-selected, validated image URL
listeners.value; // 21

// Current program / DJ
const program = await animu.getProgram();
program.isLive;            // false while AutoDJ ("Haruka Yuki") is on air
program.acceptingRequests; // whether live requests are open

// History
const played   = await animu.getTrackHistory("played");
const requests = await animu.getTrackHistory("requests");

// Streams (cached for the session, falls back to built-in list on failure)
const streams = await animu.getStreams();
```

## Configuration

```ts
import { AnimuApi } from "animu-api";

const animu = new AnimuApi({
  userAgent: "my-bot/1.0 (https://github.com/me/my-bot)", // default: "animu-api"
  timeout: 10_000,          // per-request timeout in ms (default: 20000)
  artworkQuality: "high",   // "off" | "low" | "medium" | "high" (default: "medium")
  defaultCover: "https://example.com/cover.png", // used when a track has no artwork
  fallbackStreams: [        // used when the stream list endpoint fails
    { id: "320", bitrate: 320, category: "MP3", url: "https://stream.animu.moe/320" },
  ],
});
```

All options are optional — sensible Animu defaults are built in.

## API

| Method | Description |
| --- | --- |
| `getStreamMetadata()` | Current track + listener count (`track` is `null` if the payload lacks track data) |
| `getListeners()` | Listener count only |
| `getProgram()` | Current program, DJ and live-request availability |
| `getTrackHistory(type)` | `"played"` or `"requests"` history |
| `searchMusic(params)` / `searchMusicByTitle(title)` | Search requestable tracks, paginated |
| `submitMusicRequest(submission)` | Submit a track request; returns a structured `{ success, error, detail }` result |
| `submitLiveRequest(request)` | Validate + submit a live shout-out |
| `getStreams(forceRefresh?)` | Available audio streams, memory-cached with fallback |
| `validateSession(sessionId)` | Is this PHP session id still valid? |
| `logout(sessionId)` | Best-effort server-side logout (never throws) |
| `exchangeToken(params)` | Discord OAuth2 code → `User` (includes `sessionId`) |

## Authentication (music requests)

Music requests and sessions go through Animu's Discord OAuth2 flow with PKCE,
exchanged server-side:

1. Redirect the user to `https://discord.com/api/oauth2/authorize` with your
   client id, `scopes: ["identify"]`, your `redirectUri` and a PKCE verifier.
2. Exchange the returned code:

```ts
const user = await animu.exchangeToken({ code, redirectUri, codeVerifier });
user.sessionId; // PHP session id used for authenticated calls

await animu.validateSession(user.sessionId);
await animu.submitMusicRequest({ trackId, message, sessionId: user.sessionId });
await animu.logout(user.sessionId);
```

## Error handling

- **`AnimuApiError`** — network/HTTP failures. Inspect `.statusCode`, `.url`, `.method` (or `.details`).
- **`ValidationError`** — a payload failed schema validation, or you passed invalid input to `submitLiveRequest`.

`submitMusicRequest` never throws for business errors — it returns structured codes:

```ts
import { requestResultMessage } from "animu-api";

const result = await animu.submitMusicRequest({ trackId, sessionId });
if (!result.success) {
  console.log(result.error);                   // "PEDIBLOCK", "NOLOGIN", "ONAIR", ...
  console.log(requestResultMessage(result.error, result.detail));
}
```

Codes: `PEDIBLOCK`, `ANIBLOCK`, `ARTISTBLOCK`, `COVERBLOCK`, `HARUBLOCK`,
`STRIKE_AND_OUT`, `ONAIR`, `BLOCOBLOCK`, `NOLOGIN`, `NO2FA`,
`PANEL_UNAVAILABLE`, `REQUEST_ERROR`.

## Advanced usage

Everything is exported, so you can compose your own pipeline:

```ts
import { HttpClient, parseNowPlayingTitle, selectArtwork, requestResultMessage } from "animu-api";
import { ENDPOINTS, DEFAULT_COVER } from "animu-api";
import { StreamMetadataDTOSchema } from "animu-api"; // raw zod schemas
```

`AnimuApi.raw` also exposes the underlying `HttpClient` (`.get`/`.post`) for
endpoints not covered by first-class methods.

## Development

```bash
npm install
npm run typecheck   # strict, noUncheckedIndexedAccess
npm test            # vitest, fully mocked — no network needed
npm run build       # dist/esm + dist/cjs
```

## License

MIT
