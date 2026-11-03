import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveNowPlaying, Track as ApiTrack } from "animu-api";
import { PlayerService, type PlayerServiceDependencies } from "@/core/player/player-service";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import { BACKGROUND_IDLE_CUTOFF_MS } from "@/core/player/stream-playback/background-idle";
import { HeardTrack } from "@/core/player/stream-playback/heard-track";
import { NowHearing, STATION_AFTER_PAUSE_MS } from "@/core/player/stream-playback/now-hearing";
import {
  NowPlayingRepository,
  type NowPlayingFetchers,
} from "@/core/player/stream-playback/now-playing.repository";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { createFakeTimer } from "@/core/player/__tests__/fake-timer";
import { FakePlayer } from "@/core/player/__tests__/fake-player";
import type { Stream } from "@/core/domain/stream";

// The service's module graph reaches native modules — stub them for node.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-asset", () => ({
  Asset: {
    fromModule: vi.fn(() => ({
      localUri: "file://mock/default-cover.png",
      downloadAsync: async () => ({ localUri: "file://mock/default-cover.png" }),
    })),
  },
}));
vi.mock("expo-file-system", () => ({ File: vi.fn(), Paths: { cache: "file://mock/cache" } }));
vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));
vi.mock("expo-image", () => ({
  Image: { getCachePathAsync: vi.fn(), writeToCacheAsync: vi.fn() },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("../../services/animu.service", () => ({
  animuService: { abortInFlightRequests: vi.fn() },
}));
vi.mock("../../../api/client", () => ({
  setServerSkewListener: vi.fn(),
  animuApi: {
    getStreams: vi.fn(async () => [
      { id: "high", url: "https://stream.example/192", label: "192" },
    ]),
  },
}));

/**
 * The background-idle policy end to end: a real repository (SSE handlers
 * captured, HTTP stubbed) under a real PlayerService on a fake player and a
 * mocked wall clock. What is asserted is observable behavior — is the stream
 * open, what reached the lock screen, which fetches ran.
 */

const MINUTE = 60_000;
const STREAM = { id: "high", url: "https://stream.example/192", label: "192" } as unknown as Stream;

let songCounter = 0;
const song = (raw: string): ApiTrack => {
  songCounter += 1;
  return {
    id: String(songCounter),
    raw,
    title: raw,
    anime: `${raw} (anime)`,
    artist: "Artist",
    artwork: `https://example.test/${encodeURIComponent(raw)}.jpg`,
    artworks: {},
    duration: 200_000,
    isRequest: false,
    startTime: new Date(),
    playlistName: "",
  };
};

const liveSong = (track: ApiTrack): LiveNowPlaying => ({
  track,
  listeners: { value: 10 },
  serverName: "Animu FM",
  status: "autodj",
  rawTitle: track.raw,
  album: "",
  offlineSince: null,
  message: null,
  receivedAt: new Date(),
});

interface LiveHandlers {
  onSongChange: (song: LiveNowPlaying) => void;
  onListeners: (listeners: { value: number }) => void;
  onOpen?: () => void;
}

const setup = () => {
  const player = new FakePlayer();
  const subscriptions: { handlers: LiveHandlers; unsubscribe: ReturnType<typeof vi.fn> }[] = [];
  const getStreamMetadata = vi.fn(async () => ({ track: song("Song A"), listeners: { value: 10 } }));
  const getCurrentProgram = vi.fn(async () => ({
    name: "AutoDJ",
    dj: "Haruka",
    isLive: false,
    imageUrl: "",
    info: "",
    theme: "",
    acceptingRequests: false,
  }));
  const getTrackHistory = vi.fn(async (_type: string) => [] as ApiTrack[]);
  const fetchers = {
    getStreamMetadata,
    getCurrentProgram,
    getTrackHistory,
    abortInFlightRequests: vi.fn(),
    subscribeLive: vi.fn((_quality: unknown, _cover: unknown, handlers: LiveHandlers) => {
      const unsubscribe = vi.fn();
      subscriptions.push({ handlers, unsubscribe });
      return unsubscribe;
    }),
  } as unknown as NowPlayingFetchers;
  const repoTimer = createFakeTimer();
  const repository = new NowPlayingRepository({
    fetchers,
    getCoverQuality: () => "medium",
    getDefaultCover: () => "default.png",
    timer: repoTimer,
  });
  const preferences = {
    current: STREAM,
    load: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    set: vi.fn(),
    reset: vi.fn(),
  };
  const artwork = {
    defaultCover: "file://default.png",
    init: vi.fn(async () => {}),
    apply: (t: unknown) => t,
    peek: vi.fn((_url: string): string | undefined => undefined),
    isRemote: (url: string) => url.startsWith("http"),
    resolve: vi.fn(async (url: string) => url),
    reset: vi.fn(),
  };
  const heard = new HeardTrack({
    candidates: () => [repository.currentTrack, ...repository.lastPlayedTracks],
    stationTrack: () => repository.currentTrack,
  });
  const sync = new StreamSyncEngine();
  const audible = new AudibleTrackResolver({
    getStationTrack: () => repository.currentTrack,
    sync,
    timer: createFakeTimer(),
  });
  const hearing = new NowHearing({ heard, sync, audible });
  const sampler = {
    isSupported: true,
    isActive: false,
    setEnabled: vi.fn(),
    setForeground: vi.fn(),
    setPlaying: vi.fn(),
    subscribeWindows: vi.fn(() => () => {}),
    dispose: vi.fn(),
  };
  const onTrackAnnounced = vi.fn();
  const service = new PlayerService({
    player,
    repository,
    streamPreferences: preferences,
    artwork,
    heard,
    hearing,
    sampler,
    ticker: { start: vi.fn(), stop: vi.fn() },
    onTrackAnnounced,
  } as unknown as PlayerServiceDependencies);

  return {
    service,
    player,
    repository,
    repoTimer,
    artwork,
    onTrackAnnounced,
    getCurrentProgram,
    getTrackHistory,
    subscriptions,
    /** The newest SSE subscription. */
    get live() {
      return subscriptions[subscriptions.length - 1];
    },
    playedHistoryCalls: () => getTrackHistory.mock.calls.filter(([type]) => type === "played").length,
    /** Station-side: the SSE announces `raw` as the new song. */
    announce(raw: string) {
      this.live.handlers.onSongChange(liveSong(song(raw)));
    },
    async playing() {
      await service.setupPlayer();
      await service.play();
      player.setState("playing", true);
    },
    /** Paused, then past the grace that flips the display to the station. */
    async paused() {
      await service.pause();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS + 1_000);
    },
  };
};

describe("PlayerService — realtime stream in the background", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays connected while audio plays in the background, indefinitely", async () => {
    const t = setup();
    await t.playing();
    t.service.setAppActive(false);

    for (let i = 0; i < 120; i++) {
      vi.advanceTimersByTime(3 * MINUTE); // six hours of songs
      t.announce(`Song ${i}`);
      expect(t.repository.currentTrack?.raw).toBe(`Song ${i}`);
    }
    expect(t.subscriptions).toHaveLength(1);
    expect(t.live.unsubscribe).not.toHaveBeenCalled();
    expect(t.repository.isSuspended).toBe(false);
  });

  it("keeps a reconnecting or buffering player counted as wanting audio", async () => {
    const t = setup();
    await t.playing();
    t.service.setAppActive(false);
    t.player.setState("reconnecting", true);
    vi.advanceTimersByTime(30 * MINUTE);
    t.announce("Song B");
    t.player.setState("buffering", true);
    vi.advanceTimersByTime(30 * MINUTE);
    t.announce("Song C");
    expect(t.repository.currentTrack?.raw).toBe("Song C");
    expect(t.live.unsubscribe).not.toHaveBeenCalled();
  });

  describe("paused in the background, inside the ten minutes", () => {
    it("stays live and keeps the lock screen current, but defers lyrics and history", async () => {
      const t = setup();
      await t.playing();
      await t.paused();
      t.service.setAppActive(false);
      vi.advanceTimersByTime(4 * MINUTE);

      t.onTrackAnnounced.mockClear();
      t.getTrackHistory.mockClear();
      t.artwork.resolve.mockClear();
      t.player.updateNowPlaying.mockClear();
      t.announce("Song B");

      expect(t.repository.currentTrack?.raw).toBe("Song B");
      expect(t.live.unsubscribe).not.toHaveBeenCalled();
      // Lock screen: new text, and its own single download of the cover.
      expect(t.player.updateNowPlaying).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Song B (anime)" }),
      );
      const coverUrl = "https://example.test/Song%20B.jpg";
      expect(t.artwork.resolve.mock.calls.filter(([url]) => url === coverUrl)).toHaveLength(1);
      // Nothing visible needs these yet.
      expect(t.onTrackAnnounced).not.toHaveBeenCalled();
      expect(t.playedHistoryCalls()).toBe(0);
      expect(t.repository.historyStale).toBe(true);
    });

    it("makes the deferred work up when the app returns", async () => {
      const t = setup();
      await t.playing();
      await t.paused();
      t.service.setAppActive(false);
      vi.advanceTimersByTime(4 * MINUTE);
      t.announce("Song B");
      t.onTrackAnnounced.mockClear();
      t.getTrackHistory.mockClear();

      t.service.setAppActive(true);
      await vi.advanceTimersByTimeAsync(0); // the history fetch settles

      expect(t.onTrackAnnounced).toHaveBeenCalledTimes(1);
      expect(t.onTrackAnnounced.mock.calls[0][0]).toMatchObject({ raw: "Song B" });
      expect(t.playedHistoryCalls()).toBe(1);
      expect(t.repository.historyStale).toBe(false);
      expect(t.subscriptions).toHaveLength(1); // never dropped
    });

    it("does the full work for a track change while the app is visible", async () => {
      const t = setup();
      await t.playing();
      await t.paused();
      t.onTrackAnnounced.mockClear();
      t.getTrackHistory.mockClear();
      t.announce("Song B");
      await vi.advanceTimersByTimeAsync(0);
      expect(t.onTrackAnnounced).toHaveBeenCalledTimes(1);
      expect(t.playedHistoryCalls()).toBe(1);
    });
  });

  describe("past the ten minutes", () => {
    /** Played, paused, hidden — then `afterMs` of silence before the next event. */
    const idleFor = async (afterMs: number) => {
      const t = setup();
      await t.playing();
      await t.paused();
      t.service.setAppActive(false);
      vi.advanceTimersByTime(afterMs);
      return t;
    };

    it("the first SSE event drops the connection instead of being merged", async () => {
      const t = await idleFor(BACKGROUND_IDLE_CUTOFF_MS);
      t.onTrackAnnounced.mockClear();
      t.getTrackHistory.mockClear();
      t.player.updateNowPlaying.mockClear();

      t.announce("Song B");

      expect(t.live.unsubscribe).toHaveBeenCalledTimes(1);
      expect(t.repository.isSuspended).toBe(true);
      expect(t.repository.currentTrack?.raw).toBe("Song A");
      expect(t.onTrackAnnounced).not.toHaveBeenCalled();
      expect(t.playedHistoryCalls()).toBe(0);
      expect(t.player.updateNowPlaying).not.toHaveBeenCalled();
      expect(t.repoTimer.scheduled).toEqual([]);
    });

    it("an event one millisecond short of the deadline is still merged", async () => {
      const t = await idleFor(BACKGROUND_IDLE_CUTOFF_MS - 1);
      t.announce("Song B");
      expect(t.repository.currentTrack?.raw).toBe("Song B");
      expect(t.repository.isSuspended).toBe(false);
    });

    it("the foreground reconnects, refreshes and catches the history up", async () => {
      const t = await idleFor(BACKGROUND_IDLE_CUTOFF_MS);
      t.announce("Song B"); // suspends
      t.getCurrentProgram.mockClear();
      t.getTrackHistory.mockClear();

      t.service.setAppActive(true);

      expect(t.repository.isSuspended).toBe(false);
      expect(t.subscriptions).toHaveLength(2); // the daemon seeds the new one
      expect(t.getCurrentProgram).toHaveBeenCalledTimes(1);
      expect(t.playedHistoryCalls()).toBeGreaterThanOrEqual(1);
      t.announce("Song C");
      expect(t.repository.currentTrack?.raw).toBe("Song C");
    });

    it("a lock-screen play while still hidden brings everything back", async () => {
      const t = await idleFor(BACKGROUND_IDLE_CUTOFF_MS);
      t.announce("Song B"); // suspends
      t.getCurrentProgram.mockClear();
      t.getTrackHistory.mockClear();

      // Airwave handles the remote command natively; JS only sees the status.
      t.player.setState("playing", true);

      expect(t.repository.isSuspended).toBe(false);
      expect(t.subscriptions).toHaveLength(2);
      expect(t.getCurrentProgram).toHaveBeenCalledTimes(1);
      expect(t.playedHistoryCalls()).toBeGreaterThanOrEqual(1);
      // And it stays up: playing in the background never expires.
      vi.advanceTimersByTime(30 * MINUTE);
      t.announce("Song C");
      expect(t.repository.currentTrack?.raw).toBe("Song C");
      expect(t.live.unsubscribe).not.toHaveBeenCalled();
    });

    it("a play() issued while hidden and suspended does the same", async () => {
      const t = await idleFor(BACKGROUND_IDLE_CUTOFF_MS);
      t.announce("Song B"); // suspends
      t.getCurrentProgram.mockClear();

      await t.service.play();

      expect(t.repository.isSuspended).toBe(false);
      expect(t.subscriptions).toHaveLength(2);
      expect(t.getCurrentProgram).toHaveBeenCalled();
    });

    it("releases a stuck refresh before the resume fetch", async () => {
      const t = await idleFor(BACKGROUND_IDLE_CUTOFF_MS);
      t.announce("Song B"); // suspends
      const expire = vi.spyOn(t.repository, "expireStuckRefresh");

      t.service.setAppActive(true);

      expect(expire).toHaveBeenCalled();
    });
  });

  it("pause in the foreground, then hide: a fresh ten minutes start at the hide", async () => {
    const t = setup();
    await t.playing();
    await t.paused();
    vi.advanceTimersByTime(20 * MINUTE); // paused and visible: nothing idle yet
    t.service.setAppActive(false);
    vi.advanceTimersByTime(BACKGROUND_IDLE_CUTOFF_MS - MINUTE);
    t.announce("Song B");
    expect(t.repository.currentTrack?.raw).toBe("Song B");
    expect(t.repository.isSuspended).toBe(false);
    vi.advanceTimersByTime(2 * MINUTE);
    t.announce("Song C");
    expect(t.repository.isSuspended).toBe(true);
    expect(t.repository.currentTrack?.raw).toBe("Song B");
  });

  it("hide while playing, pause later: the clock starts at the pause", async () => {
    const t = setup();
    await t.playing();
    t.service.setAppActive(false);
    vi.advanceTimersByTime(60 * MINUTE);
    await t.service.pause();
    vi.advanceTimersByTime(BACKGROUND_IDLE_CUTOFF_MS - MINUTE);
    t.announce("Song B");
    expect(t.repository.currentTrack?.raw).toBe("Song B");
    vi.advanceTimersByTime(2 * MINUTE);
    t.announce("Song C");
    expect(t.repository.isSuspended).toBe(true);
  });
});
