import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LyricsService,
  STORAGE_KEY,
  type LrcLibApi,
  type LyricsStorage,
} from "../lyrics-service";
import { lyricsStore } from "../lyrics-store";
import type { LyricCandidate } from "../types";
import type { Track } from "../../domain/track";

const SYNCED = [
  "[00:10.00]first line",
  "[00:20.00]<00:20.00>sung <00:21.00>words",
  "[00:30.00]last line",
].join("\n");

const match: LyricCandidate = {
  id: 42,
  trackName: "アイドル",
  artistName: "YOASOBI",
  albumName: "THE BOOK 3",
  durationSec: 212,
  instrumental: false,
  plainLyrics: null,
  syncedLyrics: SYNCED,
};

const makeTrack = (overrides: Partial<Track> = {}): Track =>
  ({
    id: "777",
    raw: "YOASOBI - アイドル | 推しの子",
    title: "アイドル",
    artist: "YOASOBI",
    anime: "推しの子",
    artworks: {},
    artwork: "",
    duration: 212_000,
    isRequest: false,
    startTime: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }) as Track;

const makeApi = (
  searchResults: LyricCandidate[] = [match],
  exact: LyricCandidate | null = null,
): { api: LrcLibApi; searchCalls: number[]; exactCalls: number[] } => {
  const searchCalls: number[] = [];
  const exactCalls: number[] = [];
  return {
    searchCalls,
    exactCalls,
    api: {
      search: vi.fn(async (params) => {
        searchCalls.push(params.trackName?.length ?? -1);
        return searchResults;
      }),
      getExact: vi.fn(async () => {
        exactCalls.push(1);
        return exact;
      }),
    },
  };
};

const makeStorage = (): LyricsStorage & { dump: () => string | null } => {
  let stored: string | null = null;
  return {
    getItem: vi.fn(async () => stored),
    setItem: vi.fn(async (_key: string, value: string) => {
      stored = value;
    }),
    dump: () => stored,
  };
};

const snapshot = () => lyricsStore.getSnapshot();

beforeEach(() => {
  lyricsStore.setSnapshot({
    status: "idle",
    trackKey: null,
    lines: [],
    plainText: null,
    language: "unknown",
    matched: null,
    hasMeasuredWords: false,
    updatedAt: 0,
  });
});

describe("LyricsService.syncTrack", () => {
  it("resolves synced lyrics and prepares karaoke lines", async () => {
    const { api } = makeApi();
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());

    expect(snapshot().status).toBe("found");
    expect(snapshot().trackKey).toBeTruthy();
    expect(snapshot().lines).toHaveLength(3);
    expect(snapshot().lines.every((line) => line.words.length > 0)).toBe(true);
    expect(snapshot().language).toBe("latin");
  });

  it("marks measured word timing when enhanced tags exist", async () => {
    const { api } = makeApi();
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    expect(snapshot().hasMeasuredWords).toBe(true);
  });

  it("serves repeat syncs of the same song from cache without network", async () => {
    const { api, searchCalls } = makeApi();
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    const firstRoundCalls = searchCalls.length;

    await service.syncTrack(makeTrack({ startTime: new Date("2026-01-01T00:03:32.000Z") }));

    expect(searchCalls).toHaveLength(firstRoundCalls);
    expect(snapshot().status).toBe("found");
  });

  it("goes not-found when nothing matches, and cools down afterwards", async () => {
    const { api, searchCalls } = makeApi([]);
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    expect(snapshot().status).toBe("not-found");

    searchCalls.length = 0;
    await service.syncTrack(
      makeTrack({ startTime: new Date("2026-01-01T00:03:32.000Z") }),
    );
    expect(searchCalls).toHaveLength(0);
    expect(snapshot().status).toBe("not-found");
  });

  it("retry clears the cooldown and re-resolves", async () => {
    const { api, searchCalls } = makeApi([]);
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    searchCalls.length = 0;

    await service.retry();
    expect(searchCalls.length).toBeGreaterThan(0);
    expect(snapshot().status).toBe("not-found");
  });

  it("falls back to plain lyrics when no synced body exists", async () => {
    const { api } = makeApi([
      { ...match, syncedLyrics: null, plainLyrics: "first\nsecond" },
    ]);
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    expect(snapshot().status).toBe("plain");
    expect(snapshot().lines).toHaveLength(2);
    expect(snapshot().plainText).toBe("first\nsecond");
  });

  it("falls back to plain lyrics when the synced body parses to nothing", async () => {
    const { api } = makeApi([
      { ...match, syncedLyrics: "[ti:only metadata]\nno timestamps here", plainLyrics: "plain line" },
    ]);
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    expect(snapshot().status).toBe("plain");
    expect(snapshot().plainText).toBe("plain line");
  });

  it("reports instrumental uploads", async () => {
    const { api } = makeApi([{ ...match, syncedLyrics: null, plainLyrics: null, instrumental: true }]);
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    expect(snapshot().status).toBe("instrumental");
  });

  it("stays idle for jingles and missing tracks", async () => {
    const { api, searchCalls } = makeApi();
    const service = new LyricsService({ api });

    await service.syncTrack(null);
    expect(snapshot().status).toBe("idle");

    await service.syncTrack(
      makeTrack({ raw: "animu - ident", title: "animu ident" }),
    );
    expect(snapshot().status).toBe("idle");
    expect(searchCalls).toHaveLength(0);
  });

  it("emits error (and cooldown) when the provider is unreachable", async () => {
    const api: LrcLibApi = {
      search: vi.fn(async () => {
        throw new Error("network down");
      }),
      getExact: vi.fn(async () => {
        throw new Error("network down");
      }),
    };
    const service = new LyricsService({ api });

    await service.syncTrack(makeTrack());
    expect(snapshot().status).toBe("error");

    await service.syncTrack(
      makeTrack({ startTime: new Date("2026-01-01T00:03:32.000Z") }),
    );
    expect(snapshot().status).toBe("error");
  });
});

describe("LyricsService disk cache", () => {
  it("persists found lyrics and hydrates a fresh service without network", async () => {
    const storage = makeStorage();
    const { api } = makeApi();
    const first = new LyricsService({ api, storage });

    await first.syncTrack(makeTrack());
    expect(await storage.dump()).toBeTruthy();

    const { api: secondApi, searchCalls: secondSearches } = makeApi([]);
    const second = new LyricsService({ api: secondApi, storage });
    await second.syncTrack(
      makeTrack({ startTime: new Date("2026-01-01T00:05:00.000Z") }),
    );

    expect(secondSearches).toHaveLength(0);
    expect(snapshot().status).toBe("found");
    expect(snapshot().lines).toHaveLength(3);
  });

  it("tolerates corrupt storage payloads", async () => {
    const storage = makeStorage();
    await storage.setItem(STORAGE_KEY, "not-json{{");
    const { api } = makeApi();
    const service = new LyricsService({ api, storage });

    await service.syncTrack(makeTrack());
    expect(snapshot().status).toBe("found");
  });
});
