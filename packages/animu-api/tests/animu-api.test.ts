import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimuApi } from "../src/animu-api";
import { AnimuApiError, ValidationError } from "../src/errors";
import { FALLBACK_STREAMS } from "../src/endpoints";
import {
  metadataPayload,
  metadataPayloadWithAlias,
  metadataPayloadWithoutTrack,
  playedHistoryPayload,
  programPayload,
  programPayloadAutoDJ,
  requestsHistoryPayload,
  searchResponsePayload,
  streamsPayload,
  userExchangePayload,
} from "./fixtures";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

/** Routed fake: maps URL → payload. */
function mockFetch(routes: Array<{ match: (url: string) => boolean; reply: (url: string) => Response | Promise<Response> }>) {
  const fn = vi.fn<typeof fetch>(async (input: string | URL | Request) => {
    const url = String(input);
    const route = routes.find((r) => r.match(url));
    if (!route) throw new Error(`Unhandled fetch in test: ${url}`);
    return route.reply(url);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getStreamMetadata", () => {
  it("returns mapped track and listeners", async () => {
    mockFetch([{ match: (u) => u.startsWith("https://api.animu.com.br"), reply: () => jsonResponse(metadataPayload) }]);
    const api = new AnimuApi();

    const { track, listeners } = await api.getStreamMetadata();

    expect(listeners).toEqual({ value: 21 });
    expect(track?.title).toBe("Philosophyz");
    expect(track?.id).toBe("16217");
  });

  it("resolves the currentListeners alias", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse(metadataPayloadWithAlias) }]);
    const { listeners } = await new AnimuApi().getStreamMetadata();
    expect(listeners).toEqual({ value: 7 });
  });

  it("returns a null track when payload lacks track data", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse(metadataPayloadWithoutTrack) }]);
    const { track, listeners } = await new AnimuApi().getStreamMetadata();
    expect(track).toBeNull();
    expect(listeners).toEqual({ value: 3 });
  });

  it("throws AnimuApiError on HTTP failure", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("down", 503) }]);
    await expect(new AnimuApi().getStreamMetadata()).rejects.toBeInstanceOf(AnimuApiError);
  });
});

describe("getProgram", () => {
  it("maps a live DJ program", async () => {
    mockFetch([{ match: (u) => u.includes("locutor.php"), reply: () => jsonResponse(programPayload) }]);
    const program = await new AnimuApi().getProgram();
    expect(program.isLive).toBe(true);
    expect(program.dj).toBe("Dolode");
  });

  it("maps AutoDJ as not live", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse(programPayloadAutoDJ) }]);
    const program = await new AnimuApi().getProgram();
    expect(program.isLive).toBe(false);
  });

  it("degrades malformed payloads instead of throwing", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse({ locutor: 1 }) }]);
    const program = await new AnimuApi().getProgram();
    expect(program.name).toBe("");
  });
});

describe("getTrackHistory", () => {
  it("hits the played endpoint and drops ident/invalid rows", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("ultimasmusicas"), reply: () => jsonResponse(playedHistoryPayload) },
    ]);
    const tracks = await new AnimuApi().getTrackHistory("played");

    expect(fetchMock.mock.calls[0]![0]).toContain("ultimasmusicas_json.php");
    expect(tracks).toHaveLength(2);
  });

  it("hits the requests endpoint", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("ultimospedidos"), reply: () => jsonResponse(requestsHistoryPayload) },
    ]);
    const tracks = await new AnimuApi().getTrackHistory("requests");

    expect(fetchMock.mock.calls[0]![0]).toContain("ultimospedidos_json.php");
    expect(tracks[0]?.id).toBe("9126");
  });
});

describe("searchMusic", () => {
  it("sends params and returns pagination", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("requestSearchTest"), reply: () => jsonResponse(searchResponsePayload) },
    ]);
    const api = new AnimuApi();

    const page = await api.searchMusic({ server: 1, query: "attack", limit: 25, offset: 0 });

    expect(fetchMock.mock.calls[0]![0]).toContain("query=attack");
    expect(page.totalResults).toBe(34);
    expect(page.nextPageParams?.offset).toBe(25);
    expect(page.results[0]?.song).toBe("Aegis of Love");
  });

  it("searchMusicByTitle uses the documented defaults", async () => {
    const fetchMock = mockFetch([
      { match: () => true, reply: () => jsonResponse(searchResponsePayload) },
    ]);

    await new AnimuApi().searchMusicByTitle("attack");

    expect(fetchMock.mock.calls[0]![0]).toContain("server=1");
    expect(fetchMock.mock.calls[0]![0]).toContain("requestable=true");
    expect(fetchMock.mock.calls[0]![0]).toContain("limit=25");
  });
});

describe("submitMusicRequest", () => {
  it("posts FormData with mobileapp=1 and parses the result", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("pedirquatro"), reply: () => jsonResponse("") },
    ]);

    const result = await new AnimuApi().submitMusicRequest({
      trackId: "9126",
      message: "pls",
      sessionId: "sess-1",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("mobileapp=1");
    expect(init?.method).toBe("POST");
    const form = init?.body as FormData;
    expect(form.get("allmusic")).toBe("9126");
    expect(form.get("PHPSESSID")).toBe("sess-1");
    expect(result).toEqual({ success: true });
  });

  it("surfaces structured block errors", async () => {
    mockFetch([
      { match: () => true, reply: () => jsonResponse('{"pediblock":"2026-09-03 14:00"}') },
    ]);

    const result = await new AnimuApi().submitMusicRequest({
      trackId: "1",
      sessionId: "s",
    });
    expect(result).toEqual({
      success: false,
      error: "PEDIBLOCK",
      detail: "2026-09-03 14:00",
    });
  });
});

describe("submitLiveRequest", () => {
  const valid = { name: "a", city: "b", artist: "c", music: "d", anime: "e" };

  it("posts the form and returns true for a '1' response", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("salvar.php"), reply: () => jsonResponse("1") },
    ]);

    const ok = await new AnimuApi().submitLiveRequest({ ...valid, request: "hi" });

    expect(ok).toBe(true);
    const form = (fetchMock.mock.calls[0]![1]?.body as FormData);
    expect(form.get("request")).toBe("hi");
  });

  it("returns false for any other response", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("0") }]);
    expect(await new AnimuApi().submitLiveRequest(valid)).toBe(false);
  });

  it("throws ValidationError for invalid input without hitting the network", async () => {
    const fetchMock = mockFetch([]);
    const api = new AnimuApi();

    await expect(api.submitLiveRequest({ ...valid, name: "" })).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when the network fails", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("x", 500) }]);
    expect(await new AnimuApi().submitLiveRequest(valid)).toBe(false);
  });
});

describe("getStreams", () => {
  it("fetches, coerces and caches the stream list", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("stream.animu.moe"), reply: () => jsonResponse(streamsPayload) },
    ]);
    const api = new AnimuApi();

    const streams = await api.getStreams();
    expect(streams).toEqual([
      { id: "320", bitrate: 320, category: "MP3", url: "https://stream.animu.moe/320" },
      { id: "192", bitrate: 192, category: "MP3", url: "https://stream.animu.moe/192" },
    ]);

    await api.getStreams();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await api.getStreams(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the built-in list on failure and stays resilient", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("garbage", 500) }]);
    const api = new AnimuApi();

    const streams = await api.getStreams();
    expect(streams.map((s) => s.id)).toEqual(FALLBACK_STREAMS.map((s) => s.id));
  });

  it("uses custom fallback streams from options", async () => {
    const custom = [{ id: "x", bitrate: 1, category: "X", url: "https://x.co/1" }];
    mockFetch([{ match: () => true, reply: () => jsonResponse("bad", 500) }]);

    const streams = await new AnimuApi({ fallbackStreams: custom }).getStreams();
    expect(streams).toEqual(custom);
  });

  it("clearStreamsCache forces a refetch", async () => {
    const fetchMock = mockFetch([
      { match: () => true, reply: () => jsonResponse(streamsPayload) },
    ]);
    const api = new AnimuApi();

    await api.getStreams();
    api.clearStreamsCache();
    await api.getStreams();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("validateSession / logout", () => {
  it("returns true only for a '1' response", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("chatIsThisReal"), reply: () => jsonResponse("1") },
    ]);

    expect(await new AnimuApi().validateSession("sess-1")).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toContain("PHPSESSID=sess-1");
  });

  it("returns false for other responses", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("0") }]);
    expect(await new AnimuApi().validateSession("expired")).toBe(false);
  });

  it("returns false on network errors", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("x", 500) }]);
    expect(await new AnimuApi().validateSession("sess")).toBe(false);
  });

  it("logout never throws, even on failure", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("err", 500) }]);
    await expect(new AnimuApi().logout("sess")).resolves.toBeUndefined();
  });
});

describe("exchangeToken", () => {
  const params = { code: "oauth-code", redirectUri: "animuapp://redirect", codeVerifier: "verifier" };

  it("POSTs urlencoded params and maps the user", async () => {
    const fetchMock = mockFetch([
      { match: (u) => u.includes("exchange-token"), reply: () => jsonResponse(userExchangePayload) },
    ]);

    const user = await new AnimuApi().exchangeToken(params);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("exchange-token.php");
    expect(init?.method).toBe("POST");
    const body = init?.body as string;
    expect(body).toContain("code=oauth-code");
    expect(body).toContain("code_verifier=verifier");
    expect(user.sessionId).toBe("sess-abc123");
    expect(user.mfa).toBe(true);
  });

  it("throws on server-reported errors", async () => {
    mockFetch([
      { match: () => true, reply: () => jsonResponse({ error: "invalid_grant" }, 400) },
    ]);

    await expect(new AnimuApi().exchangeToken(params)).rejects.toMatchObject({
      name: "AnimuApiError",
      statusCode: 400,
    });
  });

  it("throws when the response is not JSON", async () => {
    mockFetch([{ match: () => true, reply: () => jsonResponse("<html>boom</html>") }]);

    await expect(new AnimuApi().exchangeToken(params)).rejects.toThrow(/not valid JSON/);
  });
});

describe("options", () => {
  it("uses a neutral default user agent, not a client-specific one", async () => {
    const fetchMock = mockFetch([
      { match: () => true, reply: () => jsonResponse(metadataPayload) },
    ]);

    await new AnimuApi().getStreamMetadata();

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("animu-api");
  });

  it("applies custom user agent, timeout and artwork quality", async () => {
    const fetchMock = mockFetch([
      { match: () => true, reply: () => jsonResponse(metadataPayload) },
    ]);

    const { track } = await new AnimuApi({
      userAgent: "Custom/1.0",
      artworkQuality: "low",
    }).getStreamMetadata();

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("Custom/1.0");
    expect(track?.artwork).toBe(metadataPayload.track.artworks.tiny);
  });
});
