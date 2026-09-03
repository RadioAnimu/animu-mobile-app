import { ValidationError, type RequestResult } from "./errors.js";
import {
  MusicRequestResponseDTOSchema,
  ProgramDTOSchema,
  StreamMetadataDTOSchema,
  TrackHistorySchema,
  UserDTOSchema,
  type MusicRequestDTO,
  type ProgramDTO,
  type StreamMetadataDTO,
} from "./schemas.js";
import {
  DEFAULT_ANIME_FALLBACK,
  DEFAULT_COVER,
  ENDPOINTS,
} from "./endpoints.js";
import type {
  ArtworkQuality,
  Artworks,
  HistoryType,
  LiveRequest,
  Listeners,
  MusicRequest,
  MusicRequestPagination,
  MusicSearchParams,
  Program,
  Stream,
  Track,
  User,
} from "./types.js";

/** True when the URL ends with a known image extension. */
function isUrlAnImage(url: string): boolean {
  return /\.(jpeg|jpg|gif|png|webp)$/.test(url);
}

/**
 * Parses the now-playing rawtitle: `"Artist - Title | Anime"`.
 *
 * Splits on `" | "` for the anime, then `" - "` for artist/title.
 * Without a dash separator the whole main segment becomes the title.
 *
 * @param rawTitle - Untouched title string from the API.
 * @param animeFallback - Anime label used when no `"| Anime"` suffix exists.
 * @returns Parsed title, artist and anime parts.
 */
export function parseNowPlayingTitle(
  rawTitle: string,
  animeFallback: string = DEFAULT_ANIME_FALLBACK,
): {
  title: string;
  artist: string;
  anime: string;
} {
  if (!rawTitle) return { title: "", artist: "", anime: animeFallback };

  let anime = animeFallback;
  const [mainPart = rawTitle, animePart] = rawTitle.split(" | ");
  if (animePart) anime = animePart.trim();

  const parts = mainPart.split(" - ");
  const titlePart = parts[1];
  if (titlePart !== undefined) {
    return {
      title: titlePart.trim(),
      artist: (parts[0] ?? "").trim(),
      anime,
    };
  }
  return { title: mainPart.trim(), artist: "", anime };
}

/**
 * Parses a request-search title: `"Artist-Title|Anime"` (no spaces —
 * this endpoint uses a different convention than the now-playing rawtitle).
 *
 * Note the API's quirk: without a `"-"` separator, the whole main segment
 * becomes **both** the artist and the song.
 *
 * @param title - Untouched title string from the search endpoint.
 * @returns Parsed song, anime and artist, with placeholder fallbacks.
 */
export function parseRequestTitle(title: string): {
  song: string;
  anime: string;
  artist: string;
} {
  const [songPart = "", animePart] = title.split("|").map((s) => s.trim());
  const [artist = "", song = ""] = songPart.split("-").map((s) => s.trim());
  return {
    song: song || songPart,
    anime: animePart || "Unknown Anime",
    artist: artist || "Unknown Artist",
  };
}

/**
 * Resolves a single artwork URL from the available sizes.
 *
 * Fallback chains: `high`: large→medium→tiny; `medium`: medium→tiny (never
 * large); `low`: tiny; `off`: always the default cover. URLs that don't end
 * in a known image extension are replaced by the default cover.
 *
 * @param artworks - Sizes reported by the API, if any.
 * @param quality - Requested quality preference.
 * @param defaultCover - Cover returned when nothing usable is available.
 * @returns A validated image URL.
 */
export function selectArtwork(
  artworks: Artworks | undefined,
  quality: ArtworkQuality,
  defaultCover: string = DEFAULT_COVER,
): string {
  if (!artworks) return defaultCover;
  let result: string;
  switch (quality) {
    case "high":
      result = artworks.large || artworks.medium || artworks.tiny || defaultCover;
      break;
    case "medium":
      result = artworks.medium || artworks.tiny || defaultCover;
      break;
    case "low":
      result = artworks.tiny || defaultCover;
      break;
    default:
      result = defaultCover;
  }
  return isUrlAnImage(result) ? result : defaultCover;
}

/**
 * Maps a validated now-playing metadata payload to a {@link Track}.
 *
 * The raw title is parsed into title/artist/anime; the track is flagged as a
 * request when the raw title contains "pedido". A zero `timestart` falls
 * back to the current time.
 *
 * @param dto - Validated metadata DTO (see `StreamMetadataDTOSchema`).
 * @param artworkQuality - Quality preference for the resolved cover.
 * @param defaultCover - Cover used when the track has none.
 * @returns The mapped track, or `null` when the payload lacks track data.
 */
export function trackFromMetadata(
  dto: StreamMetadataDTO,
  artworkQuality: ArtworkQuality,
  defaultCover: string,
): Track | null {
  if (!dto?.track) return null;

  const raw = dto.rawtitle ?? "";
  const { title, artist, anime } = parseNowPlayingTitle(raw);
  const artwork = selectArtwork(dto.track.artworks, artworkQuality, defaultCover);

  return {
    id: dto.track.playlist?.track_id?.toString() ?? "0",
    raw,
    title,
    artist: artist || dto.track.artist || "",
    anime,
    artworks: dto.track.artworks ?? {},
    artwork,
    duration: dto.track.duration,
    startTime: new Date(dto.track.timestart || Date.now()),
    isRequest: raw.toLowerCase().includes("pedido"),
  };
}

/**
 * Resolves the listener count from a metadata payload.
 *
 * The field name varies between endpoints/versions — the first known alias
 * (`listeners`, `currentListeners`, `active_listeners`, `total`) with a
 * finite, non-negative value wins. Otherwise the count is `0`.
 */
export function listenersFromMetadata(
  dto: Record<string, unknown>,
): Listeners {
  const candidates = [
    dto["listeners"],
    dto["currentListeners"],
    dto["active_listeners"],
    dto["total"],
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return { value };
  }
  return { value: 0 };
}

/**
 * Maps a validated program payload to a {@link Program}.
 *
 * Business rule: the DJ is considered live only when `locutor` is non-empty
 * and not the AutoDJ persona ("Haruka Yuki"/"haru"); otherwise `dj` is
 * normalized to `"Haruka Yuki"` and `isLive` is `false`. Live requests are
 * open unless the server explicitly says `"no"`.
 */
export function programFromDTO(dto: ProgramDTO): Program {
  const locutor = dto.locutor.toLowerCase().trim();
  const isLive = !!locutor && locutor !== "haruka yuki" && locutor !== "haru";
  return {
    name: dto.programa,
    dj: isLive ? dto.locutor : "Haruka Yuki",
    isLive,
    imageUrl: dto.imagem,
    info: dto.infoPrograma,
    theme: dto.temaPrograma,
    acceptingRequests: dto.pedidos_ao_vivo !== "no",
  };
}

/**
 * Maps a history endpoint payload to tracks.
 *
 * Rows are positional PHP arrays — `[title, cover]` for played history,
 * `[title, HH:MM:SS, requestId, cover]` for requests. Rows whose title
 * contains "animu" (station jingles) are dropped; if any row fails schema
 * validation the whole payload degrades to `[]`.
 *
 * @param dto - Raw payload; validated internally.
 * @param type - Which history endpoint the payload came from.
 * @param artworkQuality - Quality preference (kept for parity; rows carry a single cover).
 * @param defaultCover - Cover used when a row has none.
 * @returns Mapped tracks; empty array for invalid payloads.
 */
export function historyFromDTO(
  dto: unknown,
  type: HistoryType,
  artworkQuality: ArtworkQuality,
  defaultCover: string,
): Track[] {
  const parsed = TrackHistorySchema.safeParse(dto);
  if (!parsed.success) return [];

  const isRequests = type === "requests";
  const tracks: Track[] = [];

  for (const item of parsed.data) {
    const [title] = item;
    if (!title || title.toLowerCase().includes("animu")) continue;

    const raw = title;
    const { title: song, artist, anime } = parseNowPlayingTitle(title);
    // Trailing tuple elements are loose (PHP arrays) — coerce here.
    const coverUrl = String((isRequests ? item[3] : item[1]) ?? "");

    tracks.push({
      id: isRequests ? String(item[2] ?? "") || "-1" : "-1",
      raw,
      title: song,
      artist,
      anime,
      artworks: { tiny: coverUrl, medium: coverUrl, large: coverUrl },
      artwork: coverUrl || defaultCover,
      duration: 0,
      isRequest: true,
      startTime: getHistoryStartTime(type, isRequests ? item[1] : ""),
    });
  }

  return tracks;
}

/**
 * Start time for a history row. Requests rows carry an `HH:MM:SS` timestamp
 * which is combined with today's date (built via Date components — parsing
 * such strings directly is unreliable on some engines). Everything else
 * uses the current time.
 */
function getHistoryStartTime(type: HistoryType, timeStr: string): Date {
  if (type === "requests" && timeStr) {
    // Build via Date components — some engines (e.g. Hermes) can't parse
    // "Wed Sep 03 2026 HH:MM:SS" style strings reliably.
    const [hours = 0, minutes = 0, seconds = 0] = timeStr
      .split(":")
      .map((part) => parseInt(part, 10) || 0);
    const date = new Date();
    date.setHours(hours, minutes, seconds, 0);
    return date;
  }
  return new Date();
}

/**
 * Maps a validated search-result row to a {@link MusicRequest}.
 *
 * Artwork paths are relative — they are prefixed with the Animu web base
 * URL. A `timestrike` value marks the track as not requestable.
 *
 * @param dto - Validated search row.
 * @param defaultCover - Cover used when no image size is present.
 */
export function musicRequestFromDTO(
  dto: MusicRequestDTO,
  defaultCover: string,
): MusicRequest {
  const { song, anime, artist } = parseRequestTitle(dto.title);
  const image = dto.image_large || dto.image_medium || dto.image_tiny;
  const artwork = image ? `${ENDPOINTS.web}${image}` : defaultCover;

  return {
    id: dto.id.toString(),
    raw: dto.title,
    song,
    anime,
    artist: dto.author || artist,
    artwork,
    requestable: !dto.timestrike,
  };
}

/**
 * Maps a validated search response to a pagination object.
 *
 * `nextPageParams` are parsed from the server's `meta.next` URL string and
 * can be passed straight back into `searchMusic`. `totalPages` is
 * `ceil(total_count / limit)`.
 *
 * @param dto - Raw response; validated internally.
 * @param defaultCover - Cover used for results without artwork.
 */
export function paginationFromDTO(
  dto: unknown,
  defaultCover: string,
): MusicRequestPagination {
  const parsed = MusicRequestResponseDTOSchema.parse(dto);
  return {
    results: parsed.objects.map((o) => musicRequestFromDTO(o, defaultCover)),
    nextPageParams: parsed.meta.next
      ? parseQueryParams(parsed.meta.next)
      : undefined,
    totalResults: parsed.meta.total_count,
    totalPages: Math.ceil(parsed.meta.total_count / parsed.meta.limit),
  };
}

/**
 * Extracts search parameters from a URL's query string, applying the
 * endpoint's documented defaults (`server: 1`, `limit: 25`, `offset: 0`;
 * `requestable` is `false` when absent).
 *
 * @param url - URL containing a query string (e.g. a `meta.next` link).
 * @throws {@link ValidationError} when the URL has no query string.
 */
export function parseQueryParams(url: string): MusicSearchParams {
  const queryString = url.split("?")[1];
  if (!queryString) throw new ValidationError("No query parameters found in URL", url);

  const params = new URLSearchParams(queryString);
  return {
    server: parseInt(params.get("server") || "1", 10),
    filter: params.get("filter") || "",
    query: params.get("query") || "",
    requestable: params.get("requestable") === "true",
    limit: parseInt(params.get("limit") || "25", 10),
    offset: parseInt(params.get("offset") || "0", 10),
  };
}

/**
 * Interprets the submission endpoint's response body as a {@link RequestResult}.
 *
 * Business rules: an empty body means success; `erro: false` (string or
 * boolean) means the panel is unavailable; the known block keys
 * (`pediblock`, `aniblock`, `artistblock`, `coverblock`) are uppercased into
 * error codes carrying the server detail; unknown JSON yields
 * `REQUEST_ERROR`; non-JSON bodies are echoed back verbatim as the error.
 *
 * @param response - Raw response text from the submission endpoint.
 */
export function parseSubmissionResponse(response: string): RequestResult {
  if (response === "") return { success: true };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response) as Record<string, unknown>;
  } catch {
    return { success: false, error: response };
  }

  if (parsed["erro"] === "false" || parsed["erro"] === false) {
    return { success: false, error: "PANEL_UNAVAILABLE" };
  }

  const knownBlocks = ["pediblock", "aniblock", "artistblock", "coverblock"];
  for (const block of knownBlocks) {
    if (parsed[block]) {
      return {
        success: false,
        error: block.toUpperCase(),
        detail: String(parsed[block]),
      };
    }
  }

  return {
    success: false,
    error: typeof parsed["erro"] === "string" ? parsed["erro"] : "REQUEST_ERROR",
  };
}

/**
 * Maps the token-exchange endpoint's payload to a {@link User}.
 *
 * Expects `{ user: {...}, PHPSESSID }`; the session id is folded into the
 * user object before schema validation.
 *
 * @param payload - Raw exchange response, already JSON-parsed.
 * @throws A zod error when the payload is malformed.
 */
export function userFromExchangePayload(payload: unknown): User {
  const data = payload as { user?: unknown; PHPSESSID?: string };
  const dto = { ...(data.user as object), PHPSESSID: data.PHPSESSID };
  return userFromDTO(UserDTOSchema.parse(dto));
}

/** Maps a validated user DTO (snake_case API fields) to a {@link User}. */
export function userFromDTO(dto: {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  avatar_url: string;
  PHPSESSID: string;
  mfa: boolean;
}): User {
  return {
    id: dto.id,
    username: dto.username,
    nickname: dto.nickname,
    avatar: dto.avatar,
    avatarUrl: dto.avatar_url,
    sessionId: dto.PHPSESSID,
    mfa: dto.mfa,
  };
}

/** Client-side validation for a live shout-out. The server does not
 *  validate these fields, so this runs before submission. Messages are
 *  plain English codes/text — display whatever suits your project. */
export function validateLiveRequest(
  data: LiveRequest,
): { success: true } | { success: false; message: string } {
  const required: { key: keyof LiveRequest; label: string }[] = [
    { key: "name", label: "name" },
    { key: "city", label: "city" },
    { key: "artist", label: "artist" },
    { key: "music", label: "music" },
    { key: "anime", label: "anime" },
  ];

  for (const { key, label } of required) {
    const value = data[key];
    if (!value || value.trim().length === 0) {
      return { success: false, message: `${label} is required` };
    }
    if (value.length > 100) {
      return {
        success: false,
        message: `${label} must be at most 100 characters`,
      };
    }
  }

  if (data.request && data.request.length > 500) {
    return {
      success: false,
      message: "request must be at most 500 characters",
    };
  }

  return { success: true };
}
