# Web

The app also runs in a browser (Expo web, `react-native-web`), meant to be
hosted on animu.moe. Same code, same screens; the platform differences are
listed below.

## Run and build

```bash
pnpm web          # dev server: http://localhost:8081
pnpm build:web    # static export → dist/web (deploy the folder as is)
pnpm test:web     # the export in Chromium and WebKit (Playwright, e2e/)
```

The export is a single-page app (`web.output: "single"` in `app.json`) with
relative paths (`app.config.js`): any static host works, from any folder —
unzip it at the root or at, say, `/teste/web/`. The app never changes the
page's URL, so no rewrite rules are needed. The fonts must be present locally
first, as for a native build ([Development](DEVELOPMENT.md#fonts)).

## What works today

Listening (with the oscilloscope, the stream-quality picker and gapless
switching), now-playing, program and listeners, synced lyrics with the
Japanese dictionary, music requests search, settings, listening stats, About.

## What the server must allow

A browser may only read a cross-origin response the server allows with CORS.
Checked from `https://animu.moe` on 2026-11-01:

| Endpoint | Used for | Status |
| --- | --- | --- |
| `api.animu.moe` (incl. `/tungtungtung/`) | live metadata | ✅ |
| `stream.animu.moe/{320,192,64}` | audio + ICY metadata | ✅ (allows `Icy-MetaData`, not `User-Agent`: the web build sends none) |
| `www.animu.moe/teste/locutor.php` | program | ✅ `*` |
| `www.animu.moe/teste/requestSearchTest.php`, `…/sistemaPedidos/pedirquatro.php` | request search / submit | ✅ `*` |
| `lrclib.net`, `cdn.jsdelivr.net`, `unpkg.com` | lyrics, Japanese dictionary | ✅ `*` |
| `www.animu.moe/teste/ultimasmusicas_json.php` | Últimas Tocadas | ❌ allows only `https://animu.com.br` |
| `www.animu.moe/teste/ultimospedidos_json.php` | Últimas Pedidas | ❌ allows only `https://animu.com.br` |
| `www.animu.moe/teste/login_system_project/api/v5/…` | sign-in, profile, avatar | ⚠️ `*` CORS, but writes from another origin get `403 forbidden_origin` (see [Sign-in](#sign-in)) |
| `stream.animu.moe/?json=1` | stream list | ❌ no CORS (the app falls back to its built-in list) |

For each ❌ endpoint the server needs, for the web app's origin:

```
Access-Control-Allow-Origin: https://animu.moe
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Session-Id
Vary: Origin
```

and must answer the `OPTIONS` preflight with those headers (JSON POSTs and the
`X-Session-Id` header are preflighted). If the app is served from
`www.animu.moe` itself, the `www.animu.moe` endpoints are same-origin and need
none of this.

Plain GETs need no preflight: in a browser the app drops the `User-Agent` and
body-less `Content-Type` headers the API package sets (`src/api/browser-request.ts`),
and LRCLIB gets its client name in `Lrclib-Client` instead of `User-Agent`.

## Sign-in

Not available on the web yet. What blocks it (checked 2026-11-01):

- **Server, providers.** `/mobile/<provider>-start.php` ends by redirecting
  `animuapp://redirect?token=<session id>`, a URL a browser can't receive.
  There is no return-URL parameter.
- **Server, writes.** The v5 API already sends `Access-Control-Allow-Origin: *`,
  but its CSRF guard answers `403 forbidden_origin` to any POST from another
  origin without `X-Session-Id`: email-code sign-in from `animu.moe` fails.
  From `www.animu.moe` itself it passes.
- **App, session.** The token is kept with `expo-secure-store`, which has no
  web implementation: saving it throws, so even a successful sign-in fails.
- **App, images.** The avatar and banner are fetched with `X-Session-Id`,
  which an `<img>` can't send.

The plan for the server: `*-start.php` accepts an allow-listed `return_to` and
a PKCE `code_challenge`; the callback redirects to
`<return_to>#code=<one-time code>` (never the token in a URL); a new
`api/v5/auth/web-exchange.php` swaps the code and verifier for the session,
once; the CSRF guard and CORS allow the web origins by name. The native
`animuapp://redirect` flow stays as it is. The app then needs a web session
store, the `#code=` callback, and blob-URL avatars.

## Platform differences

| Native | Web |
| --- | --- |
| Files (`expo-file-system`): lyrics cache, Japanese dictionary | Cache Storage (`src/utils/web-store.ts`); the dictionary download is verified with a JS MD5 |
| Cover cache with size limits (Storage screen) | the browser's HTTP cache — the Storage screen reads 0 MB |
| Lock-screen artwork downloaded to a file | the browser's media session loads covers by URL |
| Oscilloscope in a WebView | the same page in a sandboxed `srcdoc` iframe; in Safari (where Web Audio reads a playing element as silence) the player decodes the stream's own bytes for it |
| Lyrics backdrop: the cover blurred by the image view | the cover blurred once into a small canvas (a CSS `blur()` redrawn every frame ran at ~8 fps in Safari) |
| Share card: share sheet, save to photos | Web Share API with the PNG where the browser can share files, else a download |
| Phones lock to portrait off the player | no lock (a browser tab can't lock its orientation) |
| Fonts embedded by the `expo-font` config plugin | loaded at startup (`src/theme/fonts.web.ts`) |

Proxima Nova is licensed: the web build serves the same two `.ttf` files the
station's website already serves (`www.animu.moe/wp-content/uploads/2019/02/`).
Confirm the license covers it before deploying.
