import { describe, expect, it, vi } from "vitest";
import { LrcLibClient } from "../lrclib";

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

describe("LrcLibClient", () => {
  it("searches and maps rows (duration lands in seconds)", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        jsonResponse(200, [
          {
            id: 7,
            trackName: "アイドル",
            artistName: "YOASOBI",
            albumName: "THE BOOK 3",
            duration: 212.0,
            instrumental: false,
            plainLyrics: "plain",
            syncedLyrics: "[00:10.00]line",
          },
          "not-an-object",
        ]),
    );
    const client = new LrcLibClient({ fetchImpl, userAgent: "test/1.0" });

    const rows = await client.search({
      trackName: "アイドル",
      artistName: "YOASOBI",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].durationSec).toBe(212);
    expect(fetchImpl.mock.calls[0][0]).toContain("/api/search?");
    expect(fetchImpl.mock.calls[0][0]).toContain("track_name=");
    const init = fetchImpl.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["User-Agent"]).toBe("test/1.0");
  });

  it("treats 404 on exact lookup as null", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse(404, {}),
    );
    const client = new LrcLibClient({ fetchImpl, userAgent: "test/1.0" });

    const exact = await client.getExact({
      trackName: "Nope",
      artistName: "Nobody",
      durationSec: 100,
    });
    expect(exact).toBeNull();
  });

  it("zero durations collapse to null", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        jsonResponse(200, [{ id: 8, trackName: "t", artistName: "a", duration: 0 }]),
    );
    const client = new LrcLibClient({ fetchImpl, userAgent: "test/1.0" });

    const rows = await client.search({ q: "t" });
    expect(rows[0].durationSec).toBeNull();
  });

  it("surfaces HTTP failures as LrcLibError", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse(500, {}),
    );
    const client = new LrcLibClient({ fetchImpl, userAgent: "test/1.0" });

    await expect(client.search({ q: "x" })).rejects.toThrow(
      /LRCLIB request failed/,
    );
  });

  it("retries transient 503s and succeeds on a later attempt", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
      calls += 1;
      return calls < 3 ? jsonResponse(503, {}) : jsonResponse(200, []);
    });
    const client = new LrcLibClient({
      fetchImpl,
      userAgent: "test/1.0",
      retryBaseMs: 1,
    });

    const rows = await client.search({ q: "x" });
    expect(rows).toEqual([]);
    expect(calls).toBe(3);
  });

  it("gives up after exhausting retries on persistent 503", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse(503, {}),
    );
    const client = new LrcLibClient({
      fetchImpl,
      userAgent: "test/1.0",
      retries: 2,
      retryBaseMs: 1,
    });

    await expect(client.search({ q: "x" })).rejects.toThrow(/\(503\)/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry permanent client errors", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse(400, {}),
    );
    const client = new LrcLibClient({
      fetchImpl,
      userAgent: "test/1.0",
      retryBaseMs: 1,
    });

    await expect(client.search({ q: "x" })).rejects.toThrow(/\(400\)/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
