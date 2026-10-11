import { describe, expect, it, vi } from "vitest";
import { LrcLibClient, LrcLibError, toCandidate, type FetchLike } from "@/api/lrclib";

const response = (status: number, body: unknown = null) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const row = {
  id: 1,
  trackName: "Gurenge",
  artistName: "LiSA",
  albumName: "LEO-NiNE",
  duration: 235,
  instrumental: false,
  plainLyrics: "a",
  syncedLyrics: "[00:01.00]a",
};

const client = (fetch: FetchLike) => new LrcLibClient({ fetch, userAgent: "Animu/test", retryBaseMs: 0 });

describe("toCandidate", () => {
  it("validates provider rows", () => {
    expect(toCandidate(row)).toEqual({
      id: 1,
      trackName: "Gurenge",
      artistName: "LiSA",
      albumName: "LEO-NiNE",
      durationSec: 235,
      instrumental: false,
      plainLyrics: "a",
      syncedLyrics: "[00:01.00]a",
    });
    expect(toCandidate({ ...row, id: "1" })).toBeNull();
    expect(toCandidate(null)).toBeNull();
    const sparse = toCandidate({ id: 2, duration: 0, plainLyrics: "  ", trackName: 5 });
    expect(sparse).toMatchObject({ trackName: "", durationSec: null, plainLyrics: null, syncedLyrics: null });
  });
});

describe("LrcLibClient", () => {
  it("searches with the given terms and drops invalid rows", async () => {
    const fetch = vi.fn<FetchLike>(async () => response(200, [row, { nope: true }]));
    const rows = await client(fetch).search({ trackName: "Gurenge", artistName: "LiSA" });
    expect(rows).toHaveLength(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://lrclib.net/api/search?track_name=Gurenge&artist_name=LiSA");
    expect(init.headers["User-Agent"]).toBe("Animu/test");
  });

  it("looks up exactly, a 404 meaning no such song", async () => {
    const fetch = vi.fn<FetchLike>(async () => response(404));
    expect(await client(fetch).get({ trackName: "x", artistName: "y", durationSec: 194.6 })).toBeNull();
    expect(fetch.mock.calls[0][0]).toContain("duration=195");
  });

  it("retries transient failures", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(response(503))
      .mockRejectedValueOnce(new Error("socket"))
      .mockResolvedValueOnce(response(200, []));
    expect(await client(fetch).search({ q: "x" })).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up on client errors and after the retries", async () => {
    const bad = vi.fn<FetchLike>(async () => response(400));
    await expect(client(bad).search({ q: "x" })).rejects.toMatchObject({ status: 400 });
    expect(bad).toHaveBeenCalledTimes(1);
    const down = vi.fn<FetchLike>(async () => {
      throw new Error("offline");
    });
    await expect(client(down).search({ q: "x" })).rejects.toBeInstanceOf(LrcLibError);
    expect(down).toHaveBeenCalledTimes(3);
  });
});
