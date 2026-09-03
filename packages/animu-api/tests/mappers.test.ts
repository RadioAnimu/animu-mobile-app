import { afterEach, describe, expect, it, vi } from "vitest";
import {
  historyFromDTO,
  listenersFromMetadata,
  musicRequestFromDTO,
  paginationFromDTO,
  parseNowPlayingTitle,
  parseQueryParams,
  parseRequestTitle,
  parseSubmissionResponse,
  programFromDTO,
  selectArtwork,
  trackFromMetadata,
  userFromExchangePayload,
  validateLiveRequest,
} from "../src/mappers";
import {
  MusicRequestResponseDTOSchema,
  StreamMetadataDTOSchema,
} from "../src/schemas";
import { DEFAULT_COVER } from "../src/endpoints";
import {
  metadataPayload,
  playedHistoryPayload,
  programPayload,
  programPayloadAutoDJ,
  requestsHistoryPayload,
  searchResponsePayload,
  userExchangePayload,
} from "./fixtures";

afterEach(() => {
  vi.useRealTimers();
});

describe("parseNowPlayingTitle", () => {
  it("splits 'Artist - Title | Anime'", () => {
    expect(
      parseNowPlayingTitle("LiSA - Gurenge | Kimetsu no Yaiba"),
    ).toEqual({ title: "Gurenge", artist: "LiSA", anime: "Kimetsu no Yaiba" });
  });

  it("keeps the whole main part as title when there is no dash", () => {
    expect(parseNowPlayingTitle("Just A Title | Anime")).toEqual({
      title: "Just A Title",
      artist: "",
      anime: "Anime",
    });
  });

  it("falls back to the neutral anime fallback when no separator", () => {
    expect(parseNowPlayingTitle("Artist - Song").anime).toBe("Now Playing");
  });

  it("accepts a custom anime fallback", () => {
    expect(parseNowPlayingTitle("Artist - Song", "Tocando Agora").anime).toBe("Tocando Agora");
  });

  it("handles empty raw titles", () => {
    expect(parseNowPlayingTitle("")).toEqual({
      title: "",
      artist: "",
      anime: "Now Playing",
    });
  });
});

describe("parseRequestTitle", () => {
  it("splits 'Artist-Title|Anime' without spaces", () => {
    expect(parseRequestTitle("LiSA-Gurenge|Kimetsu no Yaiba")).toEqual({
      song: "Gurenge",
      anime: "Kimetsu no Yaiba",
      artist: "LiSA",
    });
  });

  it("falls back to unknown placeholders", () => {
    // No dash: the whole part becomes the artist (matches app behavior)
    expect(parseRequestTitle("Solo Song")).toEqual({
      song: "Solo Song",
      anime: "Unknown Anime",
      artist: "Solo Song",
    });
  });
});

describe("selectArtwork", () => {
  const artworks = {
    tiny: "https://x.co/tiny.png",
    medium: "https://x.co/medium.png",
    large: "https://x.co/large.png",
  };

  it("prefers the requested quality with fallback chain", () => {
    expect(selectArtwork(artworks, "high")).toBe(artworks.large);
    expect(selectArtwork(artworks, "medium")).toBe(artworks.medium);
    expect(selectArtwork(artworks, "low")).toBe(artworks.tiny);
  });

  it("falls down the chain when the preferred size is missing", () => {
    expect(selectArtwork({ large: artworks.large }, "high")).toBe(artworks.large);
    expect(selectArtwork({ tiny: artworks.tiny }, "high")).toBe(artworks.tiny);
    expect(selectArtwork({ tiny: artworks.tiny }, "medium")).toBe(artworks.tiny);
  });

  it("medium quality only falls back to tiny, never large (app parity)", () => {
    expect(selectArtwork({ large: artworks.large }, "medium")).toBe(DEFAULT_COVER);
  });

  it("returns default cover for 'off' quality, missing artworks or non-image urls", () => {
    expect(selectArtwork(artworks, "off")).toBe(DEFAULT_COVER);
    expect(selectArtwork(undefined, "high")).toBe(DEFAULT_COVER);
    expect(selectArtwork({ tiny: "https://x.co/not-an-image" }, "low")).toBe(DEFAULT_COVER);
  });
});

describe("trackFromMetadata", () => {
  it("maps a full metadata payload", () => {
    const dto = StreamMetadataDTOSchema.parse(metadataPayload);
    const track = trackFromMetadata(dto, "medium", DEFAULT_COVER);

    expect(track).toMatchObject({
      id: "16217",
      title: "Philosophyz",
      artist: "Runa Mizutani",
      anime: "Re︰Change ～Rewrite EDM Arrange Album～",
      isRequest: false,
      duration: 264000,
      artwork: metadataPayload.track.artworks.medium,
    });
    expect(track?.startTime).toEqual(new Date(1788408452000));
  });

  it("flags pedidos as requests", () => {
    const dto = StreamMetadataDTOSchema.parse({
      ...metadataPayload,
      rawtitle: "Pedido: LiSA - Gurenge | Kimetsu no Yaiba",
    });
    expect(trackFromMetadata(dto, "medium", DEFAULT_COVER)?.isRequest).toBe(true);
  });

  it("uses artist from the rawtitle parse over the track field", () => {
    const dto = StreamMetadataDTOSchema.parse({
      ...metadataPayload,
      rawtitle: "Raw Artist - Raw Title | Raw Anime",
    });
    expect(trackFromMetadata(dto, "medium", DEFAULT_COVER)?.artist).toBe("Raw Artist");
  });

  it("returns null when the payload has no track object", () => {
    expect(trackFromMetadata({} as never, "medium", DEFAULT_COVER)).toBeNull();
  });

  it("guards a zero timestart with the current time", () => {
    vi.useFakeTimers({ now: 1788408452000 });
    const dto = StreamMetadataDTOSchema.parse({
      ...metadataPayload,
      track: { ...metadataPayload.track, timestart: "0" },
    });
    expect(trackFromMetadata(dto, "medium", DEFAULT_COVER)?.startTime).toEqual(
      new Date(1788408452000),
    );
  });
});

describe("listenersFromMetadata", () => {
  it("resolves the first known alias", () => {
    expect(listenersFromMetadata({ listeners: 10, total: 99 })).toEqual({ value: 10 });
    expect(listenersFromMetadata({ active_listeners: "4" })).toEqual({ value: 4 });
  });

  it("clamps invalid values to zero", () => {
    expect(listenersFromMetadata({ listeners: -5 })).toEqual({ value: 0 });
    expect(listenersFromMetadata({ listeners: "abc" })).toEqual({ value: 0 });
    expect(listenersFromMetadata({})).toEqual({ value: 0 });
  });
});

describe("programFromDTO", () => {
  it("maps a live program", () => {
    const program = programFromDTO(programPayload as never);
    expect(program).toEqual({
      name: "Natsukashii",
      dj: "Dolode",
      isLive: true,
      imageUrl: programPayload.imagem,
      info: "Nostalgia pura.",
      theme: "Clássicas",
      acceptingRequests: true,
    });
  });

  it("maps AutoDJ as not live and requests closed", () => {
    const program = programFromDTO(programPayloadAutoDJ as never);
    expect(program.isLive).toBe(false);
    expect(program.dj).toBe("Haruka Yuki");
    expect(program.acceptingRequests).toBe(false);
  });
});

describe("historyFromDTO", () => {
  it("maps played history using element [1] as cover", () => {
    const tracks = historyFromDTO(playedHistoryPayload, "played", "medium", DEFAULT_COVER);
    expect(tracks).toHaveLength(2); // "animu" ident row dropped
    expect(tracks[0]).toMatchObject({
      id: "-1",
      title: "Renai Circulation",
      artist: "Kana Hanazawa",
      anime: "Bakemonogatari",
      artwork: "https://www.animu.moe/media/tracks/cover.jpg",
      isRequest: true,
      duration: 0,
    });
  });

  it("maps requests history using [2] as id, [3] as cover and [1] as time", () => {
    vi.useFakeTimers({ now: new Date("2026-09-03T12:00:00") });
    const tracks = historyFromDTO(requestsHistoryPayload, "requests", "medium", DEFAULT_COVER);
    expect(tracks).toHaveLength(2);

    expect(tracks[0]).toMatchObject({
      id: "9126",
      title: "Again",
      artist: "Yui",
      anime: "FMA Brotherhood",
      artwork: "https://www.animu.moe/media/tracks/req.jpg",
    });
    expect(tracks[0]?.startTime).toEqual(new Date("2026-09-03T14:32:05"));
  });

  it("returns [] for garbage input", () => {
    expect(historyFromDTO(null, "played", "medium", DEFAULT_COVER)).toEqual([]);
    expect(historyFromDTO("nope", "played", "medium", DEFAULT_COVER)).toEqual([]);
  });

  it("uses the default cover when the row has none", () => {
    const tracks = historyFromDTO([["Artist - Title | Anime", ""]], "played", "medium", DEFAULT_COVER);
    expect(tracks[0]?.artwork).toBe(DEFAULT_COVER);
  });
});

describe("musicRequestFromDTO + paginationFromDTO", () => {
  it("maps title, artwork from the web base and requestability", () => {
    const dto = MusicRequestResponseDTOSchema.parse(searchResponsePayload);
    const first = musicRequestFromDTO(dto.objects[0]!, DEFAULT_COVER);
    expect(first).toEqual({
      id: "9126",
      raw: "Aegis of Love|Ijiranaide, Nagatoro-san 2nd Attack",
      song: "Aegis of Love",
      anime: "Ijiranaide, Nagatoro-san 2nd Attack",
      artist: "Sunomiya (CV: Sayumi Suzushiro)",
      artwork: "https://www.animu.com.br//media/tracks/trackImage9126_large.jpg", // web base keeps its trailing slash (app parity)
      requestable: true,
    });
  });

  it("uses author fallback and flags timestrike as not requestable", () => {
    const dto = MusicRequestResponseDTOSchema.parse(searchResponsePayload);
    const second = musicRequestFromDTO(dto.objects[1]!, DEFAULT_COVER);
    // No dash in the song part → the whole part becomes the artist (app parity)
    expect(second.artist).toBe("Silversun");
    expect(second.requestable).toBe(true);

    const third = musicRequestFromDTO(dto.objects[2]!, DEFAULT_COVER);
    expect(third.requestable).toBe(false);
    expect(third.artwork).toBe(DEFAULT_COVER);
  });

  it("builds pagination with parsed next-page params", () => {
    const pagination = paginationFromDTO(searchResponsePayload, DEFAULT_COVER);
    expect(pagination.totalResults).toBe(34);
    expect(pagination.totalPages).toBe(2);
    expect(pagination.nextPageParams).toEqual({
      server: 1,
      filter: "",
      query: "attack",
      requestable: false, // absent in the next URL → false (app parity)
      limit: 25,
      offset: 25,
    });
    expect(pagination.results).toHaveLength(3);
  });
});

describe("parseQueryParams", () => {
  it("parses all supported params with defaults", () => {
    expect(
      parseQueryParams("https://x.co/s?server=2&filter=anime&query=hikari&requestable=true&limit=10&offset=5"),
    ).toEqual({ server: 2, filter: "anime", query: "hikari", requestable: true, limit: 10, offset: 5 });
  });

  it("throws when there is no query string", () => {
    expect(() => parseQueryParams("https://x.co/noquery")).toThrow();
  });
});

describe("parseSubmissionResponse", () => {
  it("treats an empty response as success", () => {
    expect(parseSubmissionResponse("")).toEqual({ success: true });
  });

  it("maps erro=false to PANEL_UNAVAILABLE", () => {
    expect(parseSubmissionResponse('{"erro": "false"}')).toEqual({
      success: false,
      error: "PANEL_UNAVAILABLE",
    });
    expect(parseSubmissionResponse('{"erro": false}')).toMatchObject({ error: "PANEL_UNAVAILABLE" });
  });

  it("maps known blocks to upper-case codes with detail", () => {
    expect(parseSubmissionResponse('{"pediblock": "2026-09-03 14:00:00"}')).toEqual({
      success: false,
      error: "PEDIBLOCK",
      detail: "2026-09-03 14:00:00",
    });
    expect(parseSubmissionResponse('{"aniblock": "Naruto"}')).toMatchObject({ error: "ANIBLOCK" });
    expect(parseSubmissionResponse('{"artistblock": "LiSA"}')).toMatchObject({ error: "ARTISTBLOCK" });
    expect(parseSubmissionResponse('{"coverblock": "x"}')).toMatchObject({ error: "COVERBLOCK" });
  });

  it("passes through structured string errors", () => {
    expect(parseSubmissionResponse('{"erro": "NOLOGIN"}')).toEqual({
      success: false,
      error: "NOLOGIN",
    });
  });

  it("falls back to REQUEST_ERROR for unknown objects and echoes plain text", () => {
    expect(parseSubmissionResponse('{"weird": 1}')).toEqual({
      success: false,
      error: "REQUEST_ERROR",
    });
    expect(parseSubmissionResponse("plain php error")).toEqual({
      success: false,
      error: "plain php error",
    });
  });
});

describe("userFromExchangePayload", () => {
  it("maps the exchange payload to the User domain type", () => {
    const user = userFromExchangePayload(userExchangePayload);
    expect(user).toEqual({
      id: "1234567890",
      username: "harukinha",
      nickname: "Harukinha",
      avatar: "a1b2c3",
      avatarUrl: "https://cdn.discordapp.com/avatars/1234567890/a1b2c3.png",
      sessionId: "sess-abc123",
      mfa: true,
    });
  });

  it("throws ValidationError-shaped schema error on malformed payloads", () => {
    expect(() => userFromExchangePayload({ user: {} })).toThrow();
  });
});

describe("validateLiveRequest", () => {
  const valid = {
    name: "Haru",
    city: "São Paulo",
    artist: "LiSA",
    music: "Gurenge",
    anime: "Kimetsu no Yaiba",
  };

  it("accepts a complete request", () => {
    expect(validateLiveRequest(valid)).toEqual({ success: true });
  });

  it("rejects missing or blank fields with field-name messages", () => {
    expect(validateLiveRequest({ ...valid, name: "  " })).toMatchObject({
      success: false,
      message: "name is required",
    });
    expect(validateLiveRequest({ ...valid, city: "" }).success).toBe(false);
  });

  it("rejects fields over 100 chars and requests over 500", () => {
    expect(validateLiveRequest({ ...valid, name: "a".repeat(101) }).success).toBe(false);
    expect(validateLiveRequest({ ...valid, request: "b".repeat(501) }).success).toBe(false);
  });
});
