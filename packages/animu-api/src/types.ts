/** Artwork size preference used when resolving a track's cover image. */
export type ArtworkQuality = "off" | "low" | "medium" | "high";

/** Which history endpoint to query. */
export type HistoryType = "requests" | "played";

/** Available artwork sizes, as reported by the API. */
export interface Artworks {
  tiny?: string;
  medium?: string;
  large?: string;
}

/** A track, either now playing or from a history endpoint. */
export interface Track {
  /** Playlist track id, `"0"` when unknown, `"-1"` for history rows without one. */
  id: string;
  /** Untouched title string exactly as the API reported it. */
  raw: string;
  title: string;
  artist: string;
  /** Anime the track is associated with; falls back to a generic label. */
  anime: string;
  artworks: Artworks;
  /** Single resolved cover URL, selected by quality and validated as an image. */
  artwork: string;
  /** Duration in milliseconds. `0` when unknown (history endpoints omit it). */
  duration: number;
  /** True when the raw title marks the track as a listener request. */
  isRequest: boolean;
  /** When the track started playing. History rows may approximate this. */
  startTime: Date;
}

/** The program currently on air. */
export interface Program {
  name: string;
  /** DJ currently on air; `"Haruka Yuki"` when the AutoDJ is playing. */
  dj: string;
  /** `false` while the AutoDJ ("Haruka Yuki") is on air instead of a human DJ. */
  isLive: boolean;
  imageUrl: string;
  info: string;
  theme: string;
  /** Whether the current program accepts live shout-out requests. */
  acceptingRequests: boolean;
}

/** Number of current listeners. */
export interface Listeners {
  value: number;
}

/** Result of the combined now-playing call: track + listener count. */
export interface StreamMetadata {
  /** `null` when the server payload lacks track data. */
  track: Track | null;
  listeners: Listeners;
}

/** An audio stream (relay) the radio publishes. */
export interface Stream {
  id: string;
  bitrate: number;
  category: string;
  url: string;
}

/** A track that can be requested on the music request panel. */
export interface MusicRequest {
  id: string;
  /** Untouched title string exactly as the API reported it. */
  raw: string;
  song: string;
  anime: string;
  artist: string;
  /** Fully-qualified artwork URL. */
  artwork: string;
  /** `false` when the track was played too recently to be requested again. */
  requestable: boolean;
}

/** Query parameters accepted by the music request search endpoint. */
export interface MusicSearchParams {
  server: number;
  filter?: string;
  query: string;
  requestable?: boolean;
  limit?: number;
  offset?: number;
}

/** One page of music request search results. */
export interface MusicRequestPagination {
  results: MusicRequest[];
  /** Parameters for the next page; pass straight back into `searchMusic`. */
  nextPageParams?: MusicSearchParams;
  totalResults: number;
  totalPages: number;
}

/** Payload for submitting a music request. */
export interface MusicRequestSubmission {
  /** Track id to request. */
  trackId: string;
  /** Message shown with the request on the panel. */
  message?: string;
  /** Authenticated PHP session id. */
  sessionId: string;
}

/** A live shout-out ("peça ao vivo") submitted while a DJ is on air. */
export interface LiveRequest {
  name: string;
  city: string;
  artist: string;
  music: string;
  anime: string;
  /** Optional message/recado. */
  request?: string;
}

/** An authenticated Animu user, resolved via the Discord OAuth2 exchange. */
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  avatarUrl: string;
  /** PHP session id used by authenticated endpoints. */
  sessionId: string;
  /** Whether the user has 2FA enabled on Discord (required for requests). */
  mfa: boolean;
}

/** Parameters for exchanging a Discord OAuth2 authorization code. */
export interface TokenExchangeParams {
  /** OAuth2 authorization code returned by Discord. */
  code: string;
  /** The exact redirect_uri used in the authorization request. */
  redirectUri: string;
  /** PKCE code verifier generated for the authorization request. */
  codeVerifier: string;
}

/** Constructor options for {@link AnimuApi}. All fields are optional. */
export interface AnimuApiOptions {
  /** Sent as the User-Agent header on every request. Default: `"animu-api"`. */
  userAgent?: string;
  /** Per-request timeout in ms, applied when a call doesn't override it (default: 20000). */
  timeout?: number;
  /** Artwork quality used when mapping tracks (default: `"medium"`). */
  artworkQuality?: ArtworkQuality;
  /** Cover used when a track has none (default: Animu's default cover). */
  defaultCover?: string;
  /** Streams returned when the stream list endpoint fails (default: Animu's public relays). */
  fallbackStreams?: Stream[];
}
