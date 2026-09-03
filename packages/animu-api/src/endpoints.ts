/** Canonical Animu API/service URLs used by the client. */
export const ENDPOINTS = {
  /** Animu website base URL. */
  web: "https://www.animu.com.br/",
  /** Now-playing metadata API (current track + listener count). */
  api: "https://api.animu.com.br/",
  /** Current program / DJ page endpoint. */
  program: "https://www.animu.com.br/teste/locutor.php",
  /** Latest listener requests (positional-array JSON). */
  latestRequests:
    "https://www.animu.com.br/teste/ultimospedidos_json.php",
  /** Latest played tracks (positional-array JSON). */
  latestPlayed:
    "https://www.animu.com.br/teste/ultimasmusicas_json.php",
  /** Music request search endpoint. */
  requestSearch:
    "https://www.animu.com.br/teste/requestSearchTest.php",
  /** Music request submission endpoint (expects multipart form data). */
  requestSubmit:
    "https://www.animu.com.br/teste/sistemaPedidos/pedirquatro.php",
  /** Live shout-out submission endpoint. */
  liveRequest:
    "https://www.animu.com.br/paineldj/ajaxforms(defasado)/request/salvar.php",
  /** Public stream list (`?json=1`). */
  streams: "https://stream.animu.moe/?json=1",
  /** Session validation endpoint (PHP session id check). */
  validateSession: "https://www.animu.com.br/teste/chatIsThisReal.php",
  /** Server-side logout endpoint. */
  logout: "https://www.animu.com.br/teste/byeChat.php",
  /** Discord OAuth2 code → Animu session exchange endpoint. */
  exchangeToken: "https://www.animu.com.br/teste/exchange-token.php",
  /** Official Discord server invite. */
  discord: "https://discord.animu.com.br",
} as const;

/** Cover used when a track has no usable artwork. */
export const DEFAULT_COVER =
  "https://www.animu.com.br/wp-content/uploads/2022/11/Animu-icon-para-OC.png";

/** Public relays returned when the stream list endpoint is unreachable. */
export const FALLBACK_STREAMS = [
  { id: "320", bitrate: 320, category: "MP3", url: "https://stream.animu.moe/320" },
  { id: "192", bitrate: 192, category: "MP3", url: "https://stream.animu.moe/192" },
  { id: "64", bitrate: 64, category: "AAC+", url: "https://stream.animu.moe/64" },
] as const;

/** Anime-name fallback used when a raw title has no `"| Anime"` suffix. */
export const DEFAULT_ANIME_FALLBACK = "Now Playing";

/** Default User-Agent header. Override via {@link AnimuApiOptions.userAgent}. */
export const DEFAULT_USER_AGENT = "animu-api";
