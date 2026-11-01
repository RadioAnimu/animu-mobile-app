# Web

The app also runs in a browser (Expo web, `react-native-web`), meant to be
hosted on animu.moe. Same code, same screens; the platform differences are
listed below.

## Run and build

```bash
pnpm web          # dev server: http://localhost:8081
pnpm build:web    # static export → dist/web (deploy the folder as is)
```

The export is a single-page app (`web.output: "single"` in `app.json`): any
static host works, with every unknown path served `index.html`. The fonts must
be present locally first, as for a native build ([Development](DEVELOPMENT.md#fonts)).

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
| `stream.animu.moe/{320,192,64}` | audio + ICY metadata | ✅ (allows `Icy-MetaData`) |
| `www.animu.moe/teste/locutor.php` | program | ✅ `*` |
| `www.animu.moe/teste/requestSearchTest.php`, `…/sistemaPedidos/pedirquatro.php` | request search / submit | ✅ `*` |
| `www.animu.moe/teste/exchange-token.php` | login token exchange | ✅ `*` |
| `lrclib.net`, `cdn.jsdelivr.net`, `unpkg.com` | lyrics, Japanese dictionary | ✅ `*` |
| `www.animu.moe/teste/ultimasmusicas_json.php` | Últimas Tocadas | ❌ allows only `https://animu.com.br` |
| `www.animu.moe/teste/ultimospedidos_json.php` | Últimas Pedidas | ❌ allows only `https://animu.com.br` |
| `www.animu.moe/teste/chatIsThisReal.php` | session check | ❌ no CORS |
| `www.animu.moe/teste/byeChat.php` | logout | ❌ no CORS |
| `www.animu.moe/teste/login_system_project/…` | sign-in, profile, avatar | ❌ no CORS |
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

Not available on the web yet. Every provider runs a server-side flow
(`/mobile/<provider>-start.php`) that ends by redirecting the session token to
`animuapp://redirect`, which a browser can't receive. Web sign-in needs:

1. the `*-start.php` scripts to accept a return URL on the web app's origin
   (allow-listed, e.g. `https://animu.moe/redirect`) and redirect the token
   there instead of the app scheme;
2. CORS on the login system (table above);
3. a decision on where the browser keeps the session: the native app keeps
   the token in the Keychain / Keystore and never in plain storage, which a
   browser has no equivalent of. An `HttpOnly` cookie set by the server is
   the safe option; until then nothing is persisted.

## Platform differences

| Native | Web |
| --- | --- |
| Files (`expo-file-system`): lyrics cache, Japanese dictionary | Cache Storage (`src/utils/web-store.ts`); the dictionary download is verified with a JS MD5 |
| Cover cache with size limits (Storage screen) | the browser's HTTP cache — the Storage screen reads 0 MB |
| Lock-screen artwork downloaded to a file | the browser's media session loads covers by URL |
| Oscilloscope in a WebView | the same page in a sandboxed `srcdoc` iframe |
| Share card: share sheet, save to photos | Web Share API with the PNG where the browser can share files, else a download |
| Phones lock to portrait off the player | no lock (a browser tab can't lock its orientation) |
| Fonts embedded by the `expo-font` config plugin | loaded at startup (`src/theme/fonts.web.ts`) |

Proxima Nova is licensed: the web build serves the same two `.ttf` files the
station's website already serves (`www.animu.moe/wp-content/uploads/2019/02/`).
Confirm the license covers it before deploying.
