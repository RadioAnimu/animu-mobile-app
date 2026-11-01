import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  NowPlayingMetadata as AirwaveNowPlaying,
  PlaybackState,
} from "react-native-anything-player";
import { PlayerService, type PlayerServiceDependencies } from "@/core/player/player-service";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import {
  HeardTrack,
  STATION_AHEAD_OF_AUDIO_MS,
  icyTitleInItemMs,
} from "@/core/player/stream-playback/heard-track";
import { NowHearing, STATION_AFTER_PAUSE_MS } from "@/core/player/stream-playback/now-hearing";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { jsTimer } from "@/core/player/timer";
import { playerStore, progressStore, stationStore } from "@/core/player/store";
import type { Track } from "@/core/domain/track";
import type { Stream } from "@/core/domain/stream";
import { elapsedAt } from "@/utils/progress";
import { FakePlayer } from "@/core/player/__tests__/fake-player";

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
      { id: "high", url: "https://stream.example/192", label: "192", bitrate: 192 },
      { id: "low", url: "https://stream.example/64", label: "64", bitrate: 64 },
    ]),
  },
}));

const track = (raw: string, extra: Partial<Track> = {}): Track =>
  ({
    raw,
    title: raw,
    anime: `${raw} (anime)`,
    artist: "Artist",
    artwork: `https://example.test/${encodeURIComponent(raw)}.jpg`,
    artworks: {},
    duration: 200_000,
    startTime: new Date(Date.now() - 30_000),
    ...extra,
  }) as unknown as Track;

const STREAMS: Stream[] = [
  { id: "high", url: "https://stream.example/192", label: "192", bitrate: 192 } as unknown as Stream,
  { id: "low", url: "https://stream.example/64", label: "64", bitrate: 64 } as unknown as Stream,
];

const setup = (extra: Partial<PlayerServiceDependencies> = {}) => {
  const player = new FakePlayer();
  const repository = {
    onChange: (_c: unknown) => {},
    currentTrack: track("Song A") as Track | null,
    currentProgram: { name: "P", dj: "D", isLive: false },
    listeners: null,
    lastPlayedTracks: [] as Track[],
    lastRequestedTracks: [] as Track[],
    hasTrack: true,
    showProgress: true,
    refresh: vi.fn(async () => false),
    refreshHistory: vi.fn(async () => {}),
    expireStuckRefresh: vi.fn(),
    tickLive: vi.fn(),
    dispose: vi.fn(),
    clear: vi.fn(),
    setLiveStreamActive: vi.fn(),
    isSuspended: false,
    retryPending: false,
    historyStale: false,
  };
  const preferences = {
    current: STREAMS[0],
    load: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    set: vi.fn(async (s: Stream) => {
      preferences.current = s;
    }),
    reset: vi.fn(),
  };
  const artwork = {
    defaultCover: "file://default.png",
    init: vi.fn(async () => {}),
    apply: (t: Track | null | undefined) => t,
    peek: vi.fn((_url: string): string | undefined => undefined),
    isRemote: (url: string) => url.startsWith("http"),
    resolve: vi.fn(async (url: string) => url),
    reset: vi.fn(),
    onLateResolve: null as ((url: string) => void) | null,
  };
  const heard = new HeardTrack({
    candidates: () => [repository.currentTrack, ...repository.lastPlayedTracks],
    stationTrack: () => repository.currentTrack,
  });
  const sync = new StreamSyncEngine();
  const audible = new AudibleTrackResolver({
    getStationTrack: () => repository.currentTrack,
    sync,
    timer: jsTimer,
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
  const stats = {
    initialize: vi.fn(async () => {}),
    onPlaybackStarted: vi.fn(),
    onPlaybackStopped: vi.fn(),
    onAudibleTick: vi.fn(),
    onTrackHeard: vi.fn(),
  };
  let tick: (() => void) | null = null;
  const ticker = {
    start: vi.fn((fn: () => void) => {
      tick = fn;
    }),
    stop: vi.fn(() => {
      tick = null;
    }),
  };
  const onDestroyed = vi.fn();
  const service = new PlayerService({
    player,
    repository,
    streamPreferences: preferences,
    artwork,
    heard,
    hearing,
    sampler,
    stats,
    ticker,
    onDestroyed,
    ...extra,
  } as unknown as PlayerServiceDependencies);
  return {
    service,
    player,
    heard,
    hearing,
    repository,
    preferences,
    artwork,
    sampler,
    stats,
    ticker,
    onDestroyed,
    tick: () => tick?.(),
    /** `seconds` of 1 Hz native progress readings, `lagS` behind the live edge. */
    settle(seconds: number, lagS: number) {
      for (let i = 0; i < seconds; i++) {
        vi.advanceTimersByTime(1_000);
        player.emit("progress", { liveOffset: null, bufferedAhead: lagS, position: 0 });
      }
    },
    /** The station announces a new track (SSE / poll). */
    announce(next: Track) {
      repository.lastPlayedTracks = repository.currentTrack
        ? [repository.currentTrack, ...repository.lastPlayedTracks]
        : repository.lastPlayedTracks;
      repository.currentTrack = next;
      repository.onChange({
        trackChanged: true,
        programChanged: false,
        listenersChanged: false,
        playedChanged: false,
        requestedChanged: false,
      });
    },
  };
};

/** The UI's view of the progress anchor, extrapolated to now. */
const heardProgress = () => elapsedAt(progressStore.getSnapshot(), undefined, Date.now());

const lastNowPlaying = (player: FakePlayer) =>
  player.updateNowPlaying.mock.calls.at(-1)?.[0] as AirwaveNowPlaying | undefined;

describe("PlayerService on react-native-anything-player", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("boots: streams, preferences, data, visualizer setting, stores", async () => {
    const t = setup();
    await t.service.setupPlayer();
    expect(t.preferences.load).toHaveBeenCalled();
    expect(t.repository.refresh).toHaveBeenCalled();
    expect(t.sampler.setEnabled).toHaveBeenCalled();
    expect(t.repository.setLiveStreamActive).toHaveBeenCalledWith(true);
    const snapshot = playerStore.getSnapshot();
    expect(snapshot.isInitialized).toBe(true);
    expect(snapshot.playbackState).toBe("idle");
    expect(snapshot.currentTrack?.raw).toBe("Song A");
    expect(snapshot.streamOptions).toHaveLength(2);
    expect(t.ticker.start).toHaveBeenCalled();
  });

  it("sets the lock-screen fields again right after a load (a load drops them)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    t.player.updateNowPlaying.mockClear();
    await t.service.play();
    expect(t.player.load).toHaveBeenCalledTimes(1);
    const loaded = t.player.load.mock.invocationCallOrder[0];
    const republished = t.player.updateNowPlaying.mock.invocationCallOrder.filter((order) => order > loaded);
    expect(republished.length).toBeGreaterThan(0);
    expect(t.player.updateNowPlaying).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: expect.any(String), artwork: expect.any(String) }),
    );
  });

  it("opens the preferred stream once; later plays resume in place", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    expect(t.player.load).toHaveBeenCalledTimes(1);
    const [source, options] = t.player.load.mock.calls[0];
    expect(source).toMatchObject({
      uri: "https://stream.example/192",
      live: true,
      headers: { "User-Agent": expect.any(String) },
    });
    expect(options).toEqual({ autoplay: true, quality: "high" });
    t.player.setState("playing", true);
    // A heard title: the display is not the station's, so a resume continues
    // in place (see the station-mode re-open in `play`).
    t.player.hear("Song A");
    await t.service.pause();
    expect(t.player.pause).toHaveBeenCalled();
    await t.service.play();
    expect(t.player.load).toHaveBeenCalledTimes(1);
    expect(t.player.play).toHaveBeenCalled();
  });

  it("a remote play with nothing loaded (app relaunched from Control Center) opens the stream", async () => {
    const t = setup();
    t.player.emit("remoteCommand", { command: "play" });
    await vi.waitFor(() => expect(t.player.load).toHaveBeenCalledTimes(1));
    expect(t.player.load.mock.calls[0][1]).toEqual({ autoplay: true, quality: "high" });
    // Once loaded, remote commands are Airwave's (native): no second load.
    t.player.emit("remoteCommand", { command: "togglePlayPause" });
    await Promise.resolve();
    expect(t.player.load).toHaveBeenCalledTimes(1);
  });

  it("maps the native state into the transport vocabulary", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    const states: [PlaybackState, string][] = [
      ["loading", "connecting"],
      ["buffering", "connecting"],
      ["playing", "playing"],
      ["reconnecting", "reconnecting"],
      ["paused", "paused"],
      ["error", "paused"],
    ];
    for (const [native, ui] of states) {
      t.player.setState(native, native !== "paused" && native !== "error");
      expect(playerStore.getSnapshot().playbackState).toBe(ui);
    }
    t.player.setState("playing", true);
    expect(playerStore.getSnapshot().isPlaying).toBe(true);
    t.player.setState("paused", false);
    expect(playerStore.getSnapshot().isPlaying).toBe(false);
  });

  it("tune-in: the heard title is shown at once, its position once the clock settles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    const t = setup(); // Song A: on air for 30 s
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("buffering", true);
    t.player.setState("playing", true);
    expect(playerStore.getSnapshot().syncing).toBe(true);
    t.player.hear("Song A");
    // The song is known; how far into it is not yet (the burst may still be loading).
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
    expect(playerStore.getSnapshot().syncing).toBe(true);
    expect(lastNowPlaying(t.player)?.duration).toBeUndefined();
    // 1 Hz native readings: the speaker trails the live edge by 6 s.
    t.settle(5, 6);
    expect(playerStore.getSnapshot().syncing).toBe(false);
    // Settled at the 4th reading: 34 s on air, 6 s behind, the station clock
    // 1 s ahead of its audio. The lock screen gets it then and advances it
    // natively.
    const nowPlaying = lastNowPlaying(t.player)!;
    expect(nowPlaying).toMatchObject({ title: "Song A (anime)", artist: "Artist", duration: 200 });
    expect(nowPlaying.elapsed).toBeCloseTo(28 - STATION_AHEAD_OF_AUDIO_MS / 1000, 1);
    // The UI's tick: 35 s on air.
    t.tick();
    expect(heardProgress()).toBe(29_000 - STATION_AHEAD_OF_AUDIO_MS);
    vi.useRealTimers();
  });

  it("a heard title change switches the display at the ICY offset, not before", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    // The station announces B: the speaker is still on A.
    t.announce(track("Song B", { startTime: new Date() }));
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
    // B becomes audible.
    t.player.hear("Song B");
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
    const progress = heardProgress()!;
    expect(progress).toBeGreaterThanOrEqual(icyTitleInItemMs(320));
    expect(progress).toBeLessThan(icyTitleInItemMs(320) + 200);
    expect(lastNowPlaying(t.player)).toMatchObject({ title: "Song B (anime)", duration: 200 });
    expect(t.stats.onTrackHeard).toHaveBeenCalledWith(
      expect.objectContaining({ raw: "Song B" }),
      true,
    );
  });

  it("calibrates a title change on the locked clock, not a draining buffer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    // The clock locks on a 17 s lag (64 kbps)…
    t.settle(15, 17);
    expect(t.hearing.anchored).toBe(true);
    // …then the network drops: audio plays on from the buffer, which drains,
    // so the reading falls far below the real (unchanged) lag.
    t.player.getProgress.mockReturnValue({
      position: 0,
      duration: null,
      buffered: 0,
      bufferedAhead: 4,
      liveOffset: null,
      timestamp: Date.now(),
    });
    // Song B started 17 s + 1 s (the station's lead) + its ICY offset ago.
    const start = Date.now() - 17_000 - 1_000 - icyTitleInItemMs(320);
    t.announce(track("Song B", { startTime: new Date(start) }));
    t.player.hear("Song B");
    // The sample is the station's 1 s lead — not 14 s of buffer drain, which
    // would place the next tune-in 13 s off.
    expect(Math.abs(t.heard.tuneInBiasMs - 1_000)).toBeLessThan(300);
    vi.useRealTimers();
  });

  it("reads the heard position on demand (the lyrics clock)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    expect(t.service.heardPosition()).toBeNull(); // nothing heard since opening
    t.player.hear("Song A");
    t.announce(track("Song B", { startTime: new Date() }));
    t.player.hear("Song B");
    const playing = t.service.heardPosition()!;
    expect(playing.raw).toBe("Song B");
    expect(playing.advancing).toBe(true);
    expect(playing.elapsedMs).toBeGreaterThanOrEqual(icyTitleInItemMs(320));
    expect(playing.elapsedMs).toBeLessThan(icyTitleInItemMs(320) + 200);
    t.player.setState("paused", false);
    expect(t.service.heardPosition()).toMatchObject({ raw: "Song B", advancing: false });
  });

  it("holds the heard position at the song's end until the next title", async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.announce(track("Song B", { startTime: new Date() }));
    t.player.hear("Song B");
    vi.advanceTimersByTime(250_000); // the fixture's songs last 200 s
    expect(t.service.heardPosition()).toEqual({ raw: "Song B", elapsedMs: 200_000, advancing: false });
  });

  it("tells listeners about each announced track, before it is heard", async () => {
    const onTrackAnnounced = vi.fn();
    const t = setup({ onTrackAnnounced });
    await t.service.setupPlayer();
    t.announce(track("Song B"));
    expect(onTrackAnnounced).toHaveBeenCalledWith(expect.objectContaining({ raw: "Song B" }));
  });

  it("a title heard before the API names it is adopted when the API catches up", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.player.hear("Song C");
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
    t.announce(track("Song C"));
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song C");
  });

  it("a re-open (reconnect / live-edge resume) makes the next title a tune-in", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.settle(5, 6);
    expect(lastNowPlaying(t.player)?.duration).toBe(200);
    t.player.setState("reconnecting", true);
    expect(playerStore.getSnapshot().syncing).toBe(true);
    expect(heardProgress()).toBeNull();
    // The lock screen drops the stale position too.
    expect(lastNowPlaying(t.player)?.duration).toBeUndefined();
    t.player.setState("loading", true);
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.settle(5, 8); // the new connection trails by 8 s
    t.tick();
    // 40 s on air, the new connection 8 s behind.
    expect(heardProgress()).toBe(32_000 - STATION_AHEAD_OF_AUDIO_MS);
    vi.useRealTimers();
  });

  it("a connection swapped under the playing source re-places the song", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    const t = setup(); // Song A: on air for 30 s
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    const read = (position: number, lagS: number) => {
      vi.advanceTimersByTime(1_000);
      t.player.emit("progress", { liveOffset: null, bufferedAhead: lagS, position });
    };
    for (let s = 1; s <= 5; s++) read(s, 6);
    expect(heardProgress()).not.toBeNull();
    // The connection dropped and the player played on into a fresh one: the
    // state stays "playing", only the native discontinuity tells.
    t.player.emit("discontinuity", { position: 0, timestamp: Date.now() });
    read(0.1, 14);
    expect(playerStore.getSnapshot().syncing).toBe(true);
    expect(heardProgress()).toBeNull();
    expect(lastNowPlaying(t.player)?.duration).toBeUndefined();
    // Placed again from the audible clock once it settles, the same song.
    for (let s = 1; s <= 5; s++) read(0.1 + s, 14);
    t.tick();
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
    // 41 s on air, the new connection 14 s behind.
    expect(heardProgress()).toBe(27_000 - STATION_AHEAD_OF_AUDIO_MS);
    expect(t.player.load).toHaveBeenCalledTimes(1); // nothing re-opened natively
    vi.useRealTimers();
  });

  it("a switch that fails natively (the old relay plays on) re-opens the one picked", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setQuality("high");
    t.player.setState("playing", true);
    await t.service.changeStream(STREAMS[1]);
    expect(t.player.load).toHaveBeenCalledTimes(1);
    t.player.emit("error", { code: "QUALITY_SWITCH_FAILED" }, { fatal: false });
    expect(t.player.load).toHaveBeenCalledTimes(2);
    expect(t.player.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ uri: "https://stream.example/64" }),
      { autoplay: true, quality: "low" },
    );
    // Other non-fatal errors, or a failure once the pick plays, re-open nothing.
    t.player.setQuality("low");
    t.player.emit("error", { code: "QUALITY_SWITCH_FAILED" }, { fatal: false });
    t.player.emit("error", { code: "NETWORK_ERROR" }, { fatal: false });
    expect(t.player.load).toHaveBeenCalledTimes(2);
  });

  it("a rendition switch landing while playing re-places the song on the new relay", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    const t = setup(); // Song A: on air for 30 s
    const useStream = vi.spyOn(t.heard, "useStream");
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setQuality("high");
    t.player.setState("playing", true);
    t.player.hear("Song A");
    const read = (position: number, lagS: number) => {
      vi.advanceTimersByTime(1_000);
      t.player.emit("progress", { liveOffset: null, bufferedAhead: lagS, position });
    };
    for (let s = 1; s <= 5; s++) read(s, 6);
    expect(heardProgress()).not.toBeNull();
    await t.service.changeStream(STREAMS[1]);
    expect(playerStore.getSnapshot().syncing).toBe(false); // the old relay plays on
    // The switch lands: still "playing", now the 64 kbps relay from position 0.
    t.player.setQuality("low");
    expect(useStream).toHaveBeenLastCalledWith("low", 64);
    read(0.1, 14);
    expect(playerStore.getSnapshot().syncing).toBe(true);
    expect(heardProgress()).toBeNull();
    for (let s = 1; s <= 5; s++) read(0.1 + s, 14);
    t.tick();
    expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
    // 41 s on air, the new relay 14 s behind.
    expect(heardProgress()).toBe(27_000 - STATION_AHEAD_OF_AUDIO_MS);
    expect(t.player.load).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("a rendition switch while paused waits for the re-open to re-place", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setQuality("high");
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.player.setState("paused", false);
    const reopened = vi.spyOn(t.hearing, "reopened");
    await t.service.changeStream(STREAMS[1]);
    t.player.setQuality("low");
    expect(reopened).not.toHaveBeenCalled();
    t.player.setState("loading", true);
    expect(reopened).toHaveBeenCalledTimes(1);
  });

  it("no song progress on the lock screen during a live program that sends no length", async () => {
    const t = setup();
    t.repository.currentProgram = { name: "Live", dj: "DJ", isLive: true };
    t.repository.currentTrack = track("Song A", { duration: 0 });
    t.repository.showProgress = false;
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    const nowPlaying = lastNowPlaying(t.player)!;
    expect(nowPlaying.duration).toBeUndefined();
    expect(nowPlaying.elapsed).toBeUndefined();
    expect(nowPlaying.live).toBe(true);
  });

  it("no live badge on the lock screen for filler outside a live program", async () => {
    const t = setup();
    // A jingle: no progress, but the program is not live.
    t.repository.showProgress = false;
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    const nowPlaying = lastNowPlaying(t.player)!;
    expect(nowPlaying.duration).toBeUndefined();
    expect(nowPlaying.live).toBe(false);
  });

  it("publishes the cached cover file once resolved", async () => {
    const t = setup();
    t.artwork.resolve.mockImplementation(async () => "file://cache/song-a.jpg");
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    // The resolver now has the file: `apply` swaps it in.
    t.artwork.apply = (tr) => (tr ? ({ ...tr, artwork: "file://cache/song-a.jpg" } as Track) : tr);
    t.player.hear("Song A");
    await Promise.resolve();
    await Promise.resolve();
    expect(lastNowPlaying(t.player)?.artwork).toBe("file://cache/song-a.jpg");
  });

  it("never hands the lock screen a remote cover (the default until the file lands)", async () => {
    const t = setup();
    let finish: (local: string) => void = () => {};
    t.artwork.resolve.mockImplementation(
      () => new Promise<string>((resolve) => (finish = resolve)),
    );
    await t.service.setupPlayer();
    await t.service.play();
    expect((t.player.load.mock.calls[0][0] as { metadata: { artwork: string } }).metadata.artwork).toBe(
      "file://default.png",
    );
    t.player.setState("playing", true);
    t.player.hear("Song A");
    expect(lastNowPlaying(t.player)?.artwork).toBe("file://default.png");
    // The shared cover cache finishes the one download: the file is published.
    t.artwork.apply = (tr) => (tr ? ({ ...tr, artwork: "file://cache/a.jpg" } as Track) : tr);
    finish("file://cache/a.jpg");
    await Promise.resolve();
    await Promise.resolve();
    expect(lastNowPlaying(t.player)?.artwork).toBe("file://cache/a.jpg");
    expect(t.player.updateNowPlaying.mock.calls.every(([m]) => !String(m.artwork).startsWith("http"))).toBe(true);
  });

  it("publishes a cover whose download landed after its resolve gave up", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    await Promise.resolve();
    // The resolve gave up (remote URL): the lock screen keeps the default.
    expect(lastNowPlaying(t.player)?.artwork).toBe("file://default.png");

    // The download lands later; the resolver now maps the file.
    t.artwork.apply = (tr) => (tr ? ({ ...tr, artwork: "file://cache/a.jpg" } as Track) : tr);
    t.artwork.onLateResolve?.("https://example.test/elsewhere.jpg"); // not the shown song
    expect(lastNowPlaying(t.player)?.artwork).toBe("file://default.png");
    t.artwork.onLateResolve?.(t.hearing.track?.artwork ?? "");

    expect(lastNowPlaying(t.player)?.artwork).toBe("file://cache/a.jpg");
  });

  it("an unknown heard title fetches fresh data (no timer) and falls back to the title", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.repository.refresh.mockClear();
    t.player.hear("Artist X - Live Hour | Show");
    expect(t.repository.expireStuckRefresh).toHaveBeenCalled();
    // The live stream missed the item: the HTTP metadata is fetched anyway.
    expect(t.repository.refresh).toHaveBeenCalledExactlyOnceWith({ forceMetadata: true });
    await vi.waitFor(() =>
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Artist X - Live Hour | Show"),
    );
    expect(lastNowPlaying(t.player)).toMatchObject({ artist: "Artist X" });
  });

  it("native progress readings drive the stuck-refresh watchdog and the live stream's timers (no JS timer)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    t.repository.expireStuckRefresh.mockClear();
    t.player.emit("progress", { liveOffset: null, bufferedAhead: 6, position: 0 });
    expect(t.repository.expireStuckRefresh).toHaveBeenCalledTimes(1);
    expect(t.repository.tickLive).toHaveBeenCalledTimes(1);
  });

  it("loads every stream as a rendition and switches among them without a re-open", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.changeStream(STREAMS[1]);
    expect(t.player.load).not.toHaveBeenCalled(); // nothing loaded yet
    await t.service.play();
    expect(t.player.load).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renditions: [
          { id: "high", uri: "https://stream.example/192", bitrate: 192_000 },
          { id: "low", uri: "https://stream.example/64", bitrate: 64_000 },
        ],
        live: true,
      }),
      { autoplay: true, quality: "low" },
    );
    t.player.setState("playing", true);
    await t.service.changeStream(STREAMS[0]);
    expect(t.player.selectQuality).toHaveBeenLastCalledWith("high");
    expect(t.player.load).toHaveBeenCalledTimes(1);
    expect(playerStore.getSnapshot().currentStream?.id).toBe("high");
  });

  it("publishes the station for voice and cars on setup and on a quality change", async () => {
    const publishCatalog = vi.fn(async () => {});
    const t = setup({ publishCatalog });
    await t.service.setupPlayer();
    expect(publishCatalog).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: "high" }), expect.objectContaining({ id: "low" })],
      STREAMS[0],
    );
    await t.service.changeStream(STREAMS[1]);
    expect(publishCatalog).toHaveBeenLastCalledWith(expect.any(Array), STREAMS[1]);
    expect(publishCatalog).toHaveBeenCalledTimes(2);
  });

  it("follows a player a voice request started before the app (no re-open)", async () => {
    const t = setup();
    t.player.status = {
      ...t.player.status,
      state: "playing",
      playWhenReady: true,
      quality: "low",
      selectedQuality: "low",
      qualities: [
        { id: "high", height: null, bitrate: 192_000, label: null, audioOnly: true },
        { id: "low", height: null, bitrate: 64_000, label: null, audioOnly: true },
      ],
    };
    t.preferences.current = STREAMS[1]; // the catalog's quality: the listener's pick
    await t.service.setupPlayer();
    expect(playerStore.getSnapshot().isPlaying).toBe(true);
    expect(t.player.selectQuality).not.toHaveBeenCalled();
    // The app's now-playing replaces the catalog's on the lock screen.
    expect(t.player.updateNowPlaying).toHaveBeenCalled();
    await t.service.play();
    expect(t.player.load).not.toHaveBeenCalled();
    // Its renditions switch without a gap.
    await t.service.changeStream(STREAMS[0]);
    expect(t.player.selectQuality).toHaveBeenLastCalledWith("high");
    expect(t.player.load).not.toHaveBeenCalled();
  });

  it("an adopted relay other than the listener's pick switches back to it", async () => {
    const t = setup();
    t.player.status = {
      ...t.player.status,
      state: "playing",
      playWhenReady: true,
      quality: "low",
      selectedQuality: "low",
      qualities: [
        { id: "high", height: null, bitrate: 192_000, label: null, audioOnly: true },
        { id: "low", height: null, bitrate: 64_000, label: null, audioOnly: true },
      ],
    };
    await t.service.setupPlayer(); // the pick is STREAMS[0] ("high")
    expect(t.player.selectQuality).toHaveBeenLastCalledWith("high");
    expect(t.player.load).not.toHaveBeenCalled();
  });

  it("a voice request while the app runs is followed as its own load", async () => {
    const t = setup();
    await t.service.setupPlayer();
    t.player.status = {
      ...t.player.status,
      quality: "low",
      selectedQuality: "low",
      qualities: [{ id: "low", height: null, bitrate: 64_000, label: null, audioOnly: true }],
    };
    t.player.setState("playing", true);
    t.player.emit("searchPlay", { request: { query: "", origin: "assistant" }, item: { id: "animu" } });
    t.preferences.current = STREAMS[1];
    await t.service.play();
    expect(t.player.load).not.toHaveBeenCalled();
  });

  it("a stream outside the loaded renditions, or a refused switch, re-opens", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    const other = { id: "other", url: "https://stream.example/other", bitrate: 128 } as unknown as Stream;
    await t.service.changeStream(other);
    expect(t.player.selectQuality).not.toHaveBeenCalled();
    expect(t.player.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ uri: "https://stream.example/other" }),
      { autoplay: true },
    );
    expect(t.player.load.mock.lastCall?.[0]).not.toHaveProperty("renditions");
    await t.service.changeStream(STREAMS[1]);
    t.player.selectQuality.mockRejectedValueOnce(new Error("refused"));
    await t.service.changeStream(STREAMS[0]);
    expect(t.player.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ uri: "https://stream.example/192" }),
      { autoplay: true, quality: "high" },
    );
  });

  it("listen stats follow audible playback (no background heartbeat needed)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    expect(t.stats.onPlaybackStarted).toHaveBeenCalledTimes(1);
    t.tick();
    expect(t.stats.onAudibleTick).toHaveBeenCalled();
    t.player.setState("paused", false);
    expect(t.stats.onPlaybackStopped).toHaveBeenCalledTimes(1);
  });

  it("the visualizer samples only while playing (and foregrounded)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    t.player.setState("playing", true);
    expect(t.sampler.setPlaying).toHaveBeenLastCalledWith(true);
    t.service.setAppActive(false);
    expect(t.sampler.setForeground).toHaveBeenLastCalledWith(false);
    expect(t.ticker.stop).toHaveBeenCalled();
    t.service.setAppActive(true);
    expect(t.sampler.setForeground).toHaveBeenLastCalledWith(true);
  });

  it("polls the API on the foreground tick (5 s playing, 30 s paused)", async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.service.setupPlayer();
    t.repository.refresh.mockClear();
    vi.advanceTimersByTime(10_000);
    t.tick();
    expect(t.repository.refresh).not.toHaveBeenCalled(); // paused: 30 s cadence
    vi.advanceTimersByTime(21_000);
    t.tick();
    expect(t.repository.refresh).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("skips the foreground poll while a retry backoff is pending, then resumes", async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.service.setupPlayer();
    t.repository.refresh.mockClear();

    // The repository's own retry will run the refresh: the poll stays out of its way.
    t.repository.retryPending = true;
    vi.advanceTimersByTime(40_000);
    t.tick();
    expect(t.repository.refresh).not.toHaveBeenCalled();

    // Recovered: the overdue poll fires on the very next tick.
    t.repository.retryPending = false;
    t.tick();
    expect(t.repository.refresh).toHaveBeenCalledTimes(1);

    // An explicit refresh is never blocked by a pending retry.
    t.repository.retryPending = true;
    await t.service.refreshData({ forceMetadata: true });
    expect(t.repository.refresh).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("a stream without ICY titles falls back to the audible clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    const t = setup();
    t.repository.currentTrack = track("Song A", { startTime: new Date(Date.now() - 60_000) });
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    // 1 Hz native readings: the speaker trails the live edge by 6 s.
    const second = () => {
      vi.advanceTimersByTime(1_000);
      t.player.emit("progress", { liveOffset: null, bufferedAhead: 6, position: 0 });
    };
    for (let i = 0; i < 5; i++) second();
    expect(t.hearing.mode).toBe("icy"); // still waiting for a title
    for (let i = 0; i < 10; i++) second();
    expect(t.hearing.mode).toBe("clock");
    // Taken over 12 s in (72 s on air, 6 s behind): the lock screen got 66 s
    // and advances natively from there.
    expect(lastNowPlaying(t.player)).toMatchObject({ duration: 200 });
    expect(lastNowPlaying(t.player)!.elapsed).toBeCloseTo(66, 0);
    // Now 75 s on air: the UI's tick shows 69 s.
    t.tick();
    const progress = heardProgress()!;
    expect(progress).toBeGreaterThan(68_500);
    expect(progress).toBeLessThan(69_500);
    expect(playerStore.getSnapshot().syncing).toBe(false);
    // A title is heard after all: ICY is the truth again.
    t.player.hear("Song A");
    expect(t.hearing.mode).toBe("icy");
    vi.useRealTimers();
  });

  it("delegates artwork, visualizer and history calls to their units", async () => {
    const t = setup();
    t.artwork.peek.mockReturnValue("file://cache/x.jpg");
    expect(t.service.peekArtwork("https://cdn/x.jpg")).toBe("file://cache/x.jpg");
    const onPreview = vi.fn();
    await t.service.resolveArtwork("https://cdn/x.jpg", onPreview, "https://cdn/x-small.jpg");
    expect(t.artwork.resolve).toHaveBeenCalledWith("https://cdn/x.jpg", onPreview, "https://cdn/x-small.jpg");
    expect(t.service.defaultArtwork).toBe("file://default.png");
    expect(t.service.isVisualizerSupported).toBe(true);
    t.service.setVisualizerEnabled(true);
    expect(t.sampler.setEnabled).toHaveBeenLastCalledWith(true);
    const listener = vi.fn();
    t.service.subscribeVisualizerWindows(listener);
    expect(t.sampler.subscribeWindows).toHaveBeenCalledWith(listener);
    await t.service.refreshHistory("played" as never);
    expect(t.repository.refreshHistory).toHaveBeenCalledWith("played");
    expect(t.service.isReady).toBe(true);
  });

  it("publishes station changes (program, listeners, histories)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    const played = [track("Old")];
    t.repository.lastPlayedTracks = played;
    t.repository.listeners = 42 as never;
    t.repository.onChange({
      trackChanged: false,
      programChanged: true,
      listenersChanged: true,
      playedChanged: true,
      requestedChanged: false,
    });
    expect(stationStore.getSnapshot()).toMatchObject({
      currentListeners: 42,
      lastPlayedTracks: played,
      lastRequestedTracks: undefined,
    });
    t.repository.lastPlayedTracks = [];
    t.repository.onChange({
      trackChanged: false,
      programChanged: false,
      listenersChanged: false,
      playedChanged: true,
      requestedChanged: false,
    });
    expect(stationStore.getSnapshot().lastPlayedTracks).toBeUndefined();
  });

  it("writes no store while the app is hidden, and catches up when it returns", async () => {
    const t = setup();
    await t.service.setupPlayer();
    t.service.setAppActive(false);
    t.service.setAppActive(false); // unchanged: no-op
    t.player.setState("playing", true);
    expect(playerStore.getSnapshot().playbackState).toBe("idle");
    t.service.setAppActive(true);
    expect(playerStore.getSnapshot().playbackState).toBe("playing");
  });

  it("survives a failing data fetch, load, lock-screen update and poll", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = setup();
    t.repository.refresh.mockRejectedValue(new Error("offline"));
    await t.service.setupPlayer();
    expect(playerStore.getSnapshot().isInitialized).toBe(true);
    t.player.load.mockRejectedValueOnce(new Error("bad source"));
    t.player.updateNowPlaying.mockRejectedValue(new Error("released"));
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    vi.advanceTimersByTime(6_000);
    t.tick();
    await vi.runAllTimersAsync();
    expect(warn).toHaveBeenCalledWith("[PlayerService] load:", expect.any(Error));
    expect(warn).toHaveBeenCalledWith("[PlayerService] now playing:", expect.any(Error));
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("a play that cannot restore the stream reports the error and drops the intent", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup();
    await t.service.setupPlayer();
    t.preferences.restore.mockRejectedValueOnce(new Error("storage"));
    await expect(t.service.play()).rejects.toThrow("storage");
    expect(t.service.isPlayingIntent).toBe(false);
    error.mockRestore();
  });

  it("ignores no-ops: same stream, untitled metadata, other remote commands", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.changeStream(STREAMS[0]); // already current
    expect(t.preferences.set).not.toHaveBeenCalled();
    await t.service.play();
    t.player.emit("metadata", { raw: {}, timestamp: Date.now() });
    expect(playerStore.getSnapshot().syncing).toBe(true);
    t.player.load.mockClear();
    t.player.emit("remoteCommand", { command: "next" });
    await Promise.resolve();
    expect(t.player.load).not.toHaveBeenCalled();
  });

  it("publishes the low-res cover preview first, only while it is still current", async () => {
    const t = setup();
    let preview: () => void = () => {};
    t.artwork.resolve.mockImplementation(
      (_url: string, onPreview?: (local: string) => void) =>
        new Promise<string>(() => {
          preview = () => onPreview?.("file://cache/a-small.jpg");
        }),
    );
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    const before = t.player.updateNowPlaying.mock.calls.length;
    const previewA = preview;
    previewA();
    expect(t.player.updateNowPlaying.mock.calls).toHaveLength(before + 1);
    // Another song is heard: a late preview of the old cover publishes nothing.
    t.announce(track("Song B"));
    t.player.hear("Song B");
    const after = t.player.updateNowPlaying.mock.calls.length;
    previewA();
    expect(t.player.updateNowPlaying.mock.calls).toHaveLength(after);
  });

  it("teardown during setup, twice, or with a failing release stays safe", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup();
    t.player.release.mockRejectedValueOnce(new Error("gone"));
    const setupDone = t.service.setupPlayer();
    await t.service.destroy();
    await t.service.destroy();
    await setupDone;
    expect(t.onDestroyed).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("[PlayerService] release failed:", expect.any(Error));
    expect(playerStore.getSnapshot().isInitialized).toBe(false);
    await t.service.pause();
    expect(t.player.pause).not.toHaveBeenCalled();
    t.tick();
    error.mockRestore();
  });

  it("frees the singleton before the native release, then never writes the stores again", async () => {
    const t = setup();
    await t.service.setupPlayer();
    // A play still opening the stream when teardown starts (back exit).
    let finishLoad = () => {};
    t.player.load.mockImplementationOnce(
      () => new Promise((resolve) => (finishLoad = () => resolve(t.player.status))),
    );
    const playing = t.service.play();
    await vi.waitFor(() => expect(t.player.load).toHaveBeenCalled());
    let finishRelease = () => {};
    t.player.release.mockImplementationOnce(() => new Promise<void>((resolve) => (finishRelease = resolve)));
    const destroyed = t.service.destroy();
    expect(t.onDestroyed).toHaveBeenCalled();
    expect(playerStore.getSnapshot().isInitialized).toBe(false);
    // A replacement service boots while the native release is still pending.
    playerStore.setSnapshot({ ...playerStore.getSnapshot(), isInitialized: true });
    finishLoad();
    await playing;
    t.player.setState("playing", true);
    finishRelease();
    await destroyed;
    expect(playerStore.getSnapshot().isInitialized).toBe(true);
  });

  it("destroy releases the native player and the singleton", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.destroy();
    expect(t.player.release).toHaveBeenCalled();
    expect(t.repository.dispose).toHaveBeenCalled();
    expect(t.sampler.dispose).toHaveBeenCalled();
    expect(t.onDestroyed).toHaveBeenCalled();
    expect(playerStore.getSnapshot().isInitialized).toBe(false);
    // Later events and commands are ignored.
    t.player.setState("playing", true);
    await t.service.play();
    expect(t.player.load).not.toHaveBeenCalled();
  });

  describe("with no audio, the display follows the station", () => {
    const start = () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    };
    /** Plays Song A (30 s on air at the start), hears it, settles, then pauses. */
    const playedAndPaused = async () => {
      const t = setup();
      await t.service.setupPlayer();
      await t.service.play();
      t.player.setState("playing", true);
      t.player.hear("Song A");
      t.settle(5, 6);
      await t.service.pause();
      return t;
    };

    it("a cold start shows the station's song and moves with it, without a play", async () => {
      start();
      const t = setup(); // Song A: on air for 30 s
      await t.service.setupPlayer();
      expect(t.hearing.mode).toBe("station");
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
      expect(playerStore.getSnapshot().syncing).toBe(false);
      expect(progressStore.getSnapshot()).toMatchObject({ progressMs: 30_000, progressRunning: true });
      const anchor = progressStore.getSnapshot();
      vi.advanceTimersByTime(5_000);
      t.tick();
      // The same anchor: the UI advances it itself, the store does not churn.
      expect(progressStore.getSnapshot()).toBe(anchor);
      expect(heardProgress()).toBe(35_000);
      expect(t.service.heardPosition()).toEqual({ raw: "Song A", elapsedMs: 35_000, advancing: true });
      // Nothing is heard: nothing is credited, and no lock screen exists yet.
      expect(t.stats.onTrackHeard).not.toHaveBeenCalled();
      expect(t.player.updateNowPlaying).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("a cold start moves on to the next song as the station announces it", async () => {
      start();
      const t = setup();
      await t.service.setupPlayer();
      t.announce(track("Song B", { startTime: new Date(Date.now() - 2_000) }));
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
      expect(heardProgress()).toBe(2_000);
      expect(t.service.heardPosition()).toMatchObject({ raw: "Song B", elapsedMs: 2_000 });
      expect(t.stats.onTrackHeard).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("the lyrics clock's position: held at the end, 0 before the start, unknown without one", async () => {
      start();
      const t = setup();
      await t.service.setupPlayer();
      t.announce(track("Short", { duration: 20_000 })); // started 30 s ago
      expect(t.service.heardPosition()).toEqual({ raw: "Short", elapsedMs: 20_000, advancing: false });
      t.announce(track("Later", { startTime: new Date(Date.now() + 8_000) }));
      expect(t.service.heardPosition()).toEqual({ raw: "Later", elapsedMs: 0, advancing: true });
      vi.advanceTimersByTime(10_000);
      expect(t.service.heardPosition()).toEqual({ raw: "Later", elapsedMs: 2_000, advancing: true });
      t.announce(track("Live", { startTime: undefined }));
      expect(t.service.heardPosition()).toBeNull();
      expect(progressStore.getSnapshot().progressMs).toBeNull();
      vi.useRealTimers();
    });

    it("a station jingle shows too", async () => {
      start();
      const t = setup();
      t.repository.showProgress = false;
      await t.service.setupPlayer();
      t.announce(track("Rádio Animu - Vinheta", { duration: 10_000, startTime: new Date(Date.now() - 1_000) }));
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Rádio Animu - Vinheta");
      expect(heardProgress()).toBe(1_000);
      vi.useRealTimers();
    });

    it("a brief pause keeps the heard song; the tick alone moves on once it has run out", async () => {
      start();
      const t = await playedAndPaused();
      t.announce(track("Song B", { startTime: new Date(Date.now() - 1_000) }));
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
      const frozen = heardProgress();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS - 1_000);
      t.tick();
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song A");
      expect(heardProgress()).toBe(frozen);
      expect(t.service.heardPosition()).toMatchObject({ raw: "Song A", advancing: false });
      // No other event: the next tick flips the display.
      vi.advanceTimersByTime(1_000);
      t.tick();
      expect(t.hearing.mode).toBe("station");
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
      expect(heardProgress()).toBe(1_000 + STATION_AFTER_PAUSE_MS);
      expect(progressStore.getSnapshot().progressRunning).toBe(true);
      expect(playerStore.getSnapshot().syncing).toBe(false);
      // The lock screen follows (the stream was loaded), without a re-open.
      expect(lastNowPlaying(t.player)).toMatchObject({ title: "Song B (anime)", duration: 200 });
      expect(t.player.load).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("a stopped player follows the station at once", async () => {
      start();
      const t = await playedAndPaused();
      t.announce(track("Song B", { startTime: new Date(Date.now() - 1_000) }));
      t.player.setState("stopped", false);
      expect(t.hearing.mode).toBe("station");
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
      expect(heardProgress()).toBe(1_000);
      vi.useRealTimers();
    });

    it("a station song announced while paused for long reaches the lock screen", async () => {
      start();
      const t = await playedAndPaused();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS);
      t.tick();
      t.player.updateNowPlaying.mockClear();
      t.announce(track("Song C", { startTime: new Date(Date.now() - 500) }));
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song C");
      expect(lastNowPlaying(t.player)).toMatchObject({ title: "Song C (anime)", duration: 200 });
      vi.useRealTimers();
    });

    it("play from the station's display: syncing, not heard, until the tune-in anchors", async () => {
      start();
      const t = await playedAndPaused();
      t.announce(track("Song B", { startTime: new Date(Date.now() - 12_000) }));
      t.player.setState("stopped", false); // a long pause: the stream was torn down
      expect(t.hearing.mode).toBe("station");
      const credited = t.stats.onTrackHeard.mock.calls.length;
      await t.service.play();
      // The station's song stays as the placeholder, no longer a known position.
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
      expect(playerStore.getSnapshot().syncing).toBe(true);
      expect(progressStore.getSnapshot().progressMs).toBeNull();
      expect(t.service.heardPosition()).toBeNull();
      t.player.setState("loading", true);
      t.player.setState("playing", true);
      t.player.hear("Song B");
      expect(playerStore.getSnapshot().syncing).toBe(true);
      expect(t.stats.onTrackHeard.mock.calls).toHaveLength(credited);
      t.settle(5, 6);
      expect(playerStore.getSnapshot().syncing).toBe(false);
      expect(t.stats.onTrackHeard.mock.calls.length).toBeGreaterThan(credited);
      expect(t.service.heardPosition()?.raw).toBe("Song B");
      vi.useRealTimers();
    });

    it("a play that fails, or is paused while connecting, goes back to the station", async () => {
      start();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const t = setup();
      await t.service.setupPlayer();
      t.preferences.restore.mockRejectedValueOnce(new Error("storage"));
      await expect(t.service.play()).rejects.toThrow("storage");
      expect(t.hearing.mode).toBe("station");
      expect(playerStore.getSnapshot().syncing).toBe(false);
      expect(heardProgress()).toBe(30_000);
      error.mockRestore();
      await t.service.play();
      expect(t.hearing.mode).toBe("icy");
      expect(playerStore.getSnapshot().syncing).toBe(true);
      await t.service.pause(); // while still connecting
      expect(t.hearing.mode).toBe("station");
      expect(playerStore.getSnapshot().syncing).toBe(false);
      expect(heardProgress()).toBe(30_000);
      vi.useRealTimers();
    });

    it("returning to the app after a long pause shows the station, and fetches fresh data", async () => {
      start();
      const t = await playedAndPaused();
      t.service.setAppActive(false);
      t.announce(track("Song B", { startTime: new Date(Date.now() + 30_000) }));
      vi.advanceTimersByTime(60_000);
      t.repository.refresh.mockClear();
      t.service.setAppActive(true);
      expect(t.hearing.mode).toBe("station");
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
      expect(t.repository.refresh).toHaveBeenCalledTimes(1);
      // Fresh data is not re-fetched at the next flip back and forth.
      t.service.setAppActive(false);
      t.service.setAppActive(true);
      expect(t.repository.refresh).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("a station track change in station mode reaches the lock screen once", async () => {
      start();
      const t = await playedAndPaused();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS);
      t.tick();
      expect(t.hearing.mode).toBe("station");
      // A cached cover: each report pushes synchronously, exactly once.
      t.artwork.peek.mockReturnValue("file://cache/song-c.jpg");
      t.player.updateNowPlaying.mockClear();
      t.announce(track("Song C", { startTime: new Date(Date.now() - 500) }));
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song C");
      // HeardTrack reports it (its display is empty in station mode, see
      // HeardTrack.abandon); NowHearing stays quiet — one change, one push.
      expect(t.player.updateNowPlaying).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("play from station mode after a native pause re-opens at the live edge", async () => {
      start();
      const t = await playedAndPaused();
      expect(t.player.status.state).toBe("paused"); // the native paused resume path
      t.announce(track("Song B", { startTime: new Date(Date.now() - 12_000) }));
      // The grace runs out with no state event: the tick alone flips it.
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS);
      t.tick();
      expect(t.hearing.mode).toBe("station");
      t.player.load.mockClear();
      t.player.play.mockClear();
      const credited = t.stats.onTrackHeard.mock.calls.length;
      await t.service.play();
      // An in-place resume reports no loading status and no fresh ICY title,
      // so the position would stay unknown: the stream is re-opened instead.
      expect(t.player.load).toHaveBeenCalledTimes(1);
      expect(t.player.play).not.toHaveBeenCalled();
      // The station's song stays as the placeholder, not audibly anchored.
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Song B");
      expect(progressStore.getSnapshot().progressMs).toBeNull();
      expect(playerStore.getSnapshot().syncing).toBe(true);
      expect(t.hearing.anchored).toBe(false);
      expect(t.service.heardPosition()).toBeNull();
      expect(t.stats.onTrackHeard).toHaveBeenCalledTimes(credited);
      // The tune-in title places the song once the clock settles.
      t.player.setState("playing", true);
      t.player.hear("Song B");
      t.settle(5, 6);
      expect(playerStore.getSnapshot().syncing).toBe(false);
      expect(t.hearing.anchored).toBe(true);
      expect(t.service.heardPosition()).toMatchObject({ raw: "Song B", advancing: true });
      expect(t.stats.onTrackHeard.mock.calls.length).toBeGreaterThan(credited);
      vi.useRealTimers();
    });

    it("a brief pause resumes in place, keeping the heard position", async () => {
      start();
      const t = await playedAndPaused();
      const before = t.service.heardPosition();
      expect(before).toMatchObject({ raw: "Song A", advancing: false });
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS - 1_000);
      t.tick();
      expect(t.hearing.mode).toBe("icy"); // within the grace: still the audio
      t.player.load.mockClear();
      t.player.play.mockClear();
      await t.service.play();
      // Nothing was abandoned: Airwave resumes in place, and the heard
      // position comes back exactly where the pause froze it.
      expect(t.player.play).toHaveBeenCalledTimes(1);
      expect(t.player.load).not.toHaveBeenCalled();
      expect(t.service.heardPosition()).toEqual({ ...before, advancing: true });
      vi.useRealTimers();
    });
  });

  describe("a live song's length", () => {
    const start = () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
    };
    /** Lets the estimate's promise chain run. */
    const flush = () => vi.advanceTimersByTimeAsync(0);
    /** A live program's Song A (on air 30 s) with the given station length. */
    const liveSetup = (
      duration: number,
      estimateDuration?: PlayerServiceDependencies["estimateDuration"],
    ) => {
      const t = setup({ estimateDuration });
      t.repository.currentProgram = { name: "Live", dj: "DJ", isLive: true };
      t.repository.currentTrack = track("Song A", { duration });
      // The repository hides progress on live: the service decides there.
      t.repository.showProgress = false;
      return t;
    };
    const listen = async (t: ReturnType<typeof setup>) => {
      await t.service.setupPlayer();
      await t.service.play();
      t.player.setState("playing", true);
      t.player.hear("Song A");
      t.settle(5, 6);
      await flush();
    };

    it("is estimated from the lyrics when the station sends none, for display only", async () => {
      start();
      const estimate = vi.fn(async () => 200_000);
      const t = liveSetup(0, estimate);
      await listen(t);
      expect(estimate).toHaveBeenCalledTimes(1);
      expect(estimate).toHaveBeenCalledWith(expect.objectContaining({ raw: "Song A" }));
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: true, durationMs: 200_000 });
      expect(lastNowPlaying(t.player)).toMatchObject({ duration: 200 });
      expect(lastNowPlaying(t.player)!.elapsed).toBeGreaterThan(0);
      // The sync keeps the station's word: no length, nothing is mutated.
      expect(t.hearing.track?.duration).toBe(0);
      expect(playerStore.getSnapshot().currentTrack?.duration).toBe(0);
      vi.useRealTimers();
    });

    it("uses the station's length when it sends one, and shows progress for it", async () => {
      start();
      const estimate = vi.fn(async () => 90_000);
      const t = liveSetup(240_000, estimate);
      await listen(t);
      expect(estimate).not.toHaveBeenCalled();
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: true, durationMs: 240_000 });
      expect(lastNowPlaying(t.player)).toMatchObject({ duration: 240 });
      vi.useRealTimers();
    });

    it("is not asked for outside a live program", async () => {
      start();
      const estimate = vi.fn(async () => 200_000);
      const t = setup({ estimateDuration: estimate }); // AutoDJ
      t.repository.currentTrack = track("Song A", { duration: 0 });
      t.repository.showProgress = false;
      await listen(t);
      expect(estimate).not.toHaveBeenCalled();
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: false, durationMs: 0 });
      expect(lastNowPlaying(t.player)!.duration).toBeUndefined();
      vi.useRealTimers();
    });

    it("is not asked for filler (a jingle on a live program)", async () => {
      start();
      const estimate = vi.fn(async () => 5_000);
      const t = liveSetup(0, estimate);
      t.repository.currentTrack = track("Rádio Animu - Vinheta", { duration: 0 });
      await t.service.setupPlayer();
      await flush();
      expect(estimate).not.toHaveBeenCalled();
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: false, durationMs: 0 });
      vi.useRealTimers();
    });

    it("ignores an answer for a song that is no longer heard", async () => {
      start();
      const answers = new Map<string, (ms: number) => void>();
      const estimate = vi.fn(
        (t: Track) => new Promise<number | null>((resolve) => answers.set(t.raw, resolve)),
      );
      const t = liveSetup(0, estimate);
      await listen(t);
      t.announce(track("Song B", { duration: 0, startTime: new Date() }));
      t.player.hear("Song B");
      await flush();
      expect(estimate).toHaveBeenCalledTimes(2);
      answers.get("Song A")!(200_000); // the song changed before it came
      await flush();
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: false, durationMs: 0 });
      answers.get("Song B")!(150_000);
      await flush();
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: true, durationMs: 150_000 });
      vi.useRealTimers();
    });

    it("is asked for only in the foreground: a song that started hidden is estimated on the return", async () => {
      start();
      const estimate = vi.fn(async () => 200_000);
      const t = liveSetup(0, estimate);
      t.service.setAppActive(false);
      await t.service.setupPlayer();
      await flush();
      expect(estimate).not.toHaveBeenCalled();
      t.service.setAppActive(true);
      await flush();
      expect(estimate).toHaveBeenCalledTimes(1);
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: true, durationMs: 200_000 });
      // Hidden again: the next song waits for the return too.
      t.service.setAppActive(false);
      t.announce(track("Song B", { duration: 0, startTime: new Date() }));
      await flush();
      expect(estimate).toHaveBeenCalledTimes(1);
      t.service.setAppActive(true);
      await flush();
      expect(estimate).toHaveBeenCalledTimes(2);
      expect(estimate).toHaveBeenLastCalledWith(expect.objectContaining({ raw: "Song B" }));
      vi.useRealTimers();
    });

    it("an answer that lands after the app is hidden still reaches the lock screen", async () => {
      start();
      let answer: (ms: number) => void = () => {};
      const t = liveSetup(0, () => new Promise<number | null>((resolve) => (answer = resolve)));
      await listen(t);
      expect(lastNowPlaying(t.player)!.duration).toBeUndefined();
      t.service.setAppActive(false);
      answer(180_000);
      await flush();
      expect(lastNowPlaying(t.player)).toMatchObject({ duration: 180 });
      vi.useRealTimers();
    });

    it("an estimate shorter than the song clamps the display, never the lyrics clock", async () => {
      start();
      const t = liveSetup(0, async () => 20_000); // a TV-size row; the full cut is on air
      await listen(t); // ~30 s into the song
      const position = t.service.heardPosition()!;
      expect(position.elapsedMs).toBeGreaterThan(20_000);
      expect(position.advancing).toBe(true);
      const { durationMs, ...anchor } = progressStore.getSnapshot();
      expect(durationMs).toBe(20_000);
      // Bar full, countdown at 0:00 until the next song.
      expect(elapsedAt(anchor, durationMs, Date.now())).toBe(20_000);
      expect(lastNowPlaying(t.player)).toMatchObject({ duration: 20, elapsed: 20 });
      vi.advanceTimersByTime(60_000);
      expect(t.service.heardPosition()!.elapsedMs).toBeGreaterThan(position.elapsedMs);
      vi.useRealTimers();
    });

    it("a failed lookup is asked again on the return to the foreground; one that found nothing is not", async () => {
      start();
      let online = false;
      const estimate = vi.fn(async () => {
        if (!online) throw new Error("503");
        return 200_000;
      });
      const t = liveSetup(0, estimate);
      await listen(t);
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: false, durationMs: 0 });
      const asked = estimate.mock.calls.length;
      online = true;
      t.service.setAppActive(false);
      t.service.setAppActive(true);
      await flush();
      expect(estimate).toHaveBeenCalledTimes(asked + 1);
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: true, durationMs: 200_000 });

      const none = vi.fn(async () => null);
      const u = liveSetup(0, none);
      await listen(u);
      u.service.setAppActive(false);
      u.service.setAppActive(true);
      await flush();
      expect(none).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("a program switch under the same song re-publishes the lock screen", async () => {
      start();
      const t = liveSetup(240_000);
      t.repository.currentProgram = { name: "AutoDJ", dj: "Haruka Yuki", isLive: false };
      await listen(t);
      // The repository's AutoDJ rule (no progress here) until the live show starts.
      expect(lastNowPlaying(t.player)!.duration).toBeUndefined();
      t.repository.currentProgram = { name: "Live", dj: "DJ", isLive: true };
      t.repository.onChange({
        trackChanged: false,
        programChanged: true,
        listenersChanged: false,
        playedChanged: false,
        requestedChanged: false,
      });
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: true, durationMs: 240_000 });
      expect(lastNowPlaying(t.player)).toMatchObject({ live: true, duration: 240 });
      vi.useRealTimers();
    });

    it.each([
      ["rejects", () => Promise.reject(new Error("offline"))],
      ["finds nothing", async () => null],
      ["reports no length", async () => 0],
    ])("shows no progress when the lookup %s", async (_name, estimate) => {
      start();
      const t = liveSetup(0, estimate);
      await listen(t);
      expect(progressStore.getSnapshot()).toMatchObject({ showProgress: false, durationMs: 0 });
      expect(lastNowPlaying(t.player)!.duration).toBeUndefined();
      vi.useRealTimers();
    });
  });
});
