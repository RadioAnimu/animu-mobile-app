import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "@/core/external-store";
import {
  LyricsService,
  MATCH_TTL_MS,
  MISS_TTL_MS,
  queryArtist,
  queryTitle,
  toLyrics,
} from "@/core/lyrics/lyrics-service";
import type { CachedLookup, LyricsCache, LyricsProvider } from "@/core/lyrics/ports";
import { LYRICS_IDLE, type LyricsSnapshot } from "@/core/lyrics/store";
import { kanaRomanizer } from "@/core/lyrics/text";
import type { LyricsCandidate } from "@/core/lyrics/types";
import type { Track } from "@/core/domain/track";

const track = (overrides: Partial<Track> = {}): Track =>
  ({
    id: "1",
    raw: "LiSA - Gurenge | Kimetsu no Yaiba",
    title: "Gurenge",
    artist: "LiSA",
    anime: "Kimetsu no Yaiba",
    artworks: {},
    artwork: "",
    duration: 235_000,
    isRequest: false,
    startTime: new Date(0),
    playlistName: "",
    ...overrides,
  }) as Track;

const candidate = (overrides: Partial<LyricsCandidate> = {}): LyricsCandidate => ({
  id: 7,
  trackName: "Gurenge",
  artistName: "LiSA",
  albumName: "LEO-NiNE",
  durationSec: 235,
  instrumental: false,
  plainLyrics: "強くなれる理由を知った",
  syncedLyrics: "[00:01.00]強くなれる理由を知った\n[00:05.00]僕を連れて進め",
  ...overrides,
});

class MemoryCache implements LyricsCache {
  entries = new Map<string, CachedLookup>();
  read = vi.fn(async (key: string) => this.entries.get(key) ?? null);
  write = vi.fn(async (key: string, entry: CachedLookup) => {
    this.entries.set(key, entry);
  });
  size = vi.fn(async () => 0);
  clear = vi.fn(async () => this.entries.clear());
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("LyricsService", () => {
  let provider: { get: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> };
  let cache: MemoryCache;
  let store: ReturnType<typeof createStore<LyricsSnapshot>>;
  let now: number;
  let service: LyricsService;

  beforeEach(() => {
    provider = { get: vi.fn(async () => null), search: vi.fn(async () => []) };
    cache = new MemoryCache();
    store = createStore<LyricsSnapshot>(LYRICS_IDLE);
    now = 1_000_000;
    service = new LyricsService({
      provider: provider as unknown as LyricsProvider,
      cache,
      store,
      romanizer: () => kanaRomanizer,
      now: () => now,
    });
  });

  it("shows timed lyrics from the exact lookup, one search looking for a romaji twin", async () => {
    provider.get.mockResolvedValue(candidate());
    service.show(track());
    expect(store.getSnapshot().status).toBe("loading");
    await flush();
    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.trackKey).toBe(LyricsService.keyOf(track()));
    expect(snapshot.lyrics?.kind).toBe("synced");
    expect(provider.get).toHaveBeenCalledWith({ trackName: "Gurenge", artistName: "LiSA", durationSec: 235 });
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(snapshot.lyrics?.kind === "synced" && snapshot.lyrics.romaji).toBeNull();
    expect(cache.write).toHaveBeenCalledTimes(1);
  });

  it("widens the search until lyrics timed for this cut turn up", async () => {
    provider.search
      .mockResolvedValueOnce([candidate({ id: 1, durationSec: 90 })]) // TV size: other cut
      .mockResolvedValueOnce([candidate({ id: 2, durationSec: 236 })]);
    service.show(track());
    await flush();
    expect(provider.search).toHaveBeenNthCalledWith(1, { trackName: "Gurenge", artistName: "LiSA" });
    expect(provider.search).toHaveBeenNthCalledWith(2, { q: "LiSA Gurenge" });
    expect(provider.search).toHaveBeenCalledTimes(2);
    const lyrics = store.getSnapshot().lyrics;
    expect(lyrics?.kind === "synced" && lyrics.source.id).toBe(2);
  });

  it("keeps searching past a romaji upload for the original script", async () => {
    const romaji = candidate({ id: 1, syncedLyrics: "[00:01.00]Tsuyoku nareru riyuu wo shitta" });
    provider.get.mockResolvedValue(romaji);
    provider.search.mockResolvedValueOnce([]).mockResolvedValueOnce([candidate({ id: 2, trackName: "Gurenge" })]);
    service.show(track());
    await flush();
    expect(provider.search).toHaveBeenCalledTimes(2);
    const lyrics = store.getSnapshot().lyrics;
    expect(lyrics?.kind === "synced" && lyrics.source.id).toBe(2);
  });

  it("pairs the original with a romaji upload of the same lines", async () => {
    const original = candidate({ syncedLyrics: "[00:01.00]強くなれる理由を知った\n[00:05.00]僕を連れて進め" });
    const romaji = candidate({ id: 8, syncedLyrics: "[00:01.10]Tsuyoku nareru riyuu wo shitta\n[00:05.05]Boku wo tsurete susume" });
    provider.get.mockResolvedValue(original);
    provider.search.mockResolvedValueOnce([romaji]);
    service.show(track());
    await flush();
    expect(provider.search).toHaveBeenCalledTimes(1);
    const lyrics = store.getSnapshot().lyrics;
    expect(lyrics?.kind === "synced" && lyrics.romaji).toEqual(["Tsuyoku nareru riyuu wo shitta", "Boku wo tsurete susume"]);
  });

  it("keeps a romaji upload when it is all there is", async () => {
    provider.get.mockResolvedValue(candidate({ syncedLyrics: "[00:01.00]Tsuyoku nareru riyuu wo shitta" }));
    service.show(track());
    await flush();
    expect(provider.search).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot().lyrics?.kind).toBe("synced");
  });

  it("shows another cut's lyrics untimed when nothing fits", async () => {
    provider.search.mockResolvedValue([candidate({ durationSec: 90 })]);
    service.show(track());
    await flush();
    const lyrics = store.getSnapshot().lyrics;
    expect(lyrics?.kind).toBe("plain");
    expect(lyrics?.kind === "plain" && lyrics.otherCut).toBe(true);
    expect(provider.search).toHaveBeenCalledTimes(3);
  });

  it("caches a miss for a while, then asks again", async () => {
    service.show(track());
    await flush();
    expect(store.getSnapshot().status).toBe("missing");
    const calls = provider.search.mock.calls.length;

    const fresh = new LyricsService({ provider: provider as unknown as LyricsProvider, cache, store, romanizer: () => kanaRomanizer, now: () => now });
    fresh.show(track());
    await flush();
    expect(provider.search.mock.calls.length).toBe(calls);

    now += MISS_TTL_MS + 1;
    const later = new LyricsService({ provider: provider as unknown as LyricsProvider, cache, store, romanizer: () => kanaRomanizer, now: () => now });
    later.show(track());
    await flush();
    expect(provider.search.mock.calls.length).toBeGreaterThan(calls);
  });

  it("serves found lyrics from the disk cache until they expire", async () => {
    cache.entries.set(LyricsService.keyOf(track()), {
      savedAt: now - MATCH_TTL_MS + 10,
      result: { kind: "match", candidate: candidate(), timed: true },
    });
    service.show(track());
    await flush();
    expect(store.getSnapshot().status).toBe("ready");
    expect(provider.get).not.toHaveBeenCalled();
  });

  it("never shows a lookup that lands after the song changed", async () => {
    const slow = deferred<LyricsCandidate | null>();
    provider.get.mockReturnValueOnce(slow.promise);
    service.show(track());
    service.show(track({ raw: "Aimer - Zankyosanka", title: "Zankyosanka", artist: "Aimer", duration: 185_000 }));
    provider.get.mockResolvedValue(candidate({ id: 9, trackName: "Zankyosanka", artistName: "Aimer", durationSec: 185 }));
    await flush();
    slow.resolve(candidate());
    await flush();
    const snapshot = store.getSnapshot();
    expect(snapshot.trackKey).toContain("zankyosanka");
    expect(snapshot.lyrics?.kind === "synced" && snapshot.lyrics.source.id).toBe(9);
  });

  it("shares one lookup between the screen and a prefetch", async () => {
    const slow = deferred<LyricsCandidate | null>();
    provider.get.mockReturnValueOnce(slow.promise);
    service.show(track());
    service.prefetch(track());
    slow.resolve(candidate());
    await flush();
    expect(provider.get).toHaveBeenCalledTimes(1);
  });

  it("prefetches only while lyrics are on screen", async () => {
    service.prefetch(track());
    expect(provider.get).not.toHaveBeenCalled();
    service.show(track({ title: "Other", raw: "x - Other" }));
    service.prefetch(track());
    await flush();
    expect(provider.get).toHaveBeenCalledWith(expect.objectContaining({ trackName: "Gurenge" }));
  });

  it("reports a failure and retries on demand", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    provider.get.mockRejectedValueOnce(new Error("offline"));
    service.show(track());
    await flush();
    expect(store.getSnapshot().status).toBe("error");
    provider.get.mockResolvedValue(candidate());
    service.retry();
    await flush();
    expect(store.getSnapshot().status).toBe("ready");
    warn.mockRestore();
  });

  it("is idle for station filler and when hidden", async () => {
    service.show(track({ raw: "Rádio Animu - Jingle | Passagem", artist: "Rádio Animu", anime: "Passagem" }));
    expect(store.getSnapshot()).toEqual(LYRICS_IDLE);
    provider.get.mockResolvedValue(candidate());
    service.show(track());
    await flush();
    service.hide();
    expect(store.getSnapshot()).toEqual(LYRICS_IDLE);
  });

  it("forgets everything on clear", async () => {
    provider.get.mockResolvedValue(candidate());
    service.show(track());
    await flush();
    await service.clear();
    expect(cache.clear).toHaveBeenCalled();
  });
});

describe("query terms", () => {
  it("drops qualifiers from the title", () => {
    expect(queryTitle("Sanctuary (Opening)")).toBe("Sanctuary");
    expect(queryTitle("Yume wo Idaite ~Hajimari no Crissroad~")).toBe("Yume wo Idaite");
    expect(queryTitle("RISE UP -English Ver.-")).toBe("RISE UP");
    expect(queryTitle("(Opening)")).toBe("(Opening)");
  });

  it("keeps the first credited artist, bands with & included", () => {
    expect(queryArtist("Hachiman Hikigaya (CV: Takuya Eguchi) with Yoshiteru Zaimokuza")).toBe("Hachiman Hikigaya");
    expect(queryArtist("Oranges & Lemons")).toBe("Oranges & Lemons");
    expect(queryArtist("Yuji Ohno feat. Akari Dritschler")).toBe("Yuji Ohno");
  });
});

describe("toLyrics", () => {
  it("is null for a miss and an instrumental for a flagged row without text", () => {
    expect(toLyrics({ kind: "none" })).toBeNull();
    const inst = candidate({ instrumental: true, plainLyrics: null, syncedLyrics: null });
    expect(toLyrics({ kind: "match", candidate: inst, timed: false })?.kind).toBe("instrumental");
  });

  it("falls back to plain text when the synced body has no timed lines", () => {
    const broken = candidate({ syncedLyrics: "[ar:LiSA]\nno stamps" });
    const lyrics = toLyrics({ kind: "match", candidate: broken, timed: true });
    expect(lyrics?.kind).toBe("plain");
    expect(lyrics?.kind === "plain" && lyrics.otherCut).toBe(false);
  });

  it("detects the language", () => {
    const ja = candidate({ syncedLyrics: "[00:01.00]強くなれる理由を知った" });
    const lyrics = toLyrics({ kind: "match", candidate: ja, timed: true });
    expect(lyrics?.kind === "synced" && lyrics.language).toBe("ja");
  });
});
