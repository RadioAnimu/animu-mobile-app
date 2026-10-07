import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MediaMetadata,
  NowPlayingMetadata as AirwaveNowPlaying,
  PlaybackState,
  PlayerEventMap,
  PlayerStatus,
} from "react-native-anything-player";
import { PlayerService, type PlayerServiceDependencies } from "@/core/player/player-service";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import { HeardTrack, ICY_AFTER_START_MS } from "@/core/player/stream-playback/heard-track";
import { NowHearing } from "@/core/player/stream-playback/now-hearing";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { jsTimer } from "@/core/player/timer";
import { playerStore, progressStore, stationStore } from "@/core/player/store";
import type { Track } from "@/core/domain/track";
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
      { id: "low", url: "https://stream.example/64", label: "64" },
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
  { id: "high", url: "https://stream.example/192", label: "192" } as unknown as Stream,
  { id: "low", url: "https://stream.example/64", label: "64" } as unknown as Stream,
];

/** The slice of an Airwave player the service drives, with event emitters. */
class FakePlayer {
  status: PlayerStatus = {
    state: "idle",
    playWhenReady: false,
    loadId: 0,
    isLive: false,
    duration: null,
    seekable: false,
    interruption: null,
    error: null,
    reconnect: null,
    network: "online",
    volume: 1,
    muted: false,
    rate: 1,
  };
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  load = vi.fn(async (_source: unknown, options?: { autoplay?: boolean }) => {
    this.setState("loading", options?.autoplay ?? false);
    return this.status;
  });
  play = vi.fn(async () => {
    this.setState(this.status.state === "paused" ? "playing" : this.status.state, true);
    return this.status;
  });
  pause = vi.fn(async () => {
    this.setState("paused", false);
    return this.status;
  });
  updateNowPlaying = vi.fn(async (_m: AirwaveNowPlaying) => {});
  setAudioSampling = vi.fn(() => true);
  release = vi.fn(async () => {});
  getProgress = vi.fn(() => ({
    position: 0,
    duration: null,
    buffered: 0,
    bufferedAhead: 6,
    liveOffset: null,
    timestamp: Date.now(),
  }));

  on<E extends keyof PlayerEventMap>(event: E, listener: PlayerEventMap[E]): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (...args: unknown[]) => void);
    this.listeners.set(event, set);
    return () => set.delete(listener as (...args: unknown[]) => void);
  }

  setState(state: PlaybackState, playWhenReady = this.status.playWhenReady): void {
    this.status = { ...this.status, state, playWhenReady };
    this.emit("status", this.status);
  }

  /** An ICY title becomes audible. */
  hear(title: string, at = Date.now()): void {
    const metadata: MediaMetadata = { title, raw: { StreamTitle: title }, timestamp: at };
    this.emit("metadata", metadata);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((l) => l(...args));
  }
}

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
    dispose: vi.fn(),
    clear: vi.fn(),
    setLiveStreamActive: vi.fn(),
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
    reportAppliedDelay: vi.fn(),
    setSyncTrim: vi.fn(),
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
    expect(options).toEqual({ autoplay: true });
    t.player.setState("playing", true);
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
    expect(t.player.load.mock.calls[0][1]).toEqual({ autoplay: true });
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
    // Settled at the 4th reading: 34 s on air, 6 s behind. The lock screen
    // gets it then and advances it natively.
    const nowPlaying = lastNowPlaying(t.player)!;
    expect(nowPlaying).toMatchObject({ title: "Song A (anime)", artist: "Artist", duration: 200 });
    expect(nowPlaying.elapsed).toBeCloseTo(28, 1);
    // The UI's tick: 35 s on air.
    t.tick();
    expect(progressStore.getSnapshot().currentTrackProgress).toBe(29_000);
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
    const progress = progressStore.getSnapshot().currentTrackProgress!;
    expect(progress).toBeGreaterThanOrEqual(ICY_AFTER_START_MS);
    expect(progress).toBeLessThan(ICY_AFTER_START_MS + 200);
    expect(lastNowPlaying(t.player)).toMatchObject({ title: "Song B (anime)", duration: 200 });
    expect(t.stats.onTrackHeard).toHaveBeenCalledWith(
      expect.objectContaining({ raw: "Song B" }),
      true,
    );
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
    expect(playing.elapsedMs).toBeGreaterThanOrEqual(ICY_AFTER_START_MS);
    expect(playing.elapsedMs).toBeLessThan(ICY_AFTER_START_MS + 200);
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
    expect(progressStore.getSnapshot().currentTrackProgress).toBeNull();
    // The lock screen drops the stale position too.
    expect(lastNowPlaying(t.player)?.duration).toBeUndefined();
    t.player.setState("loading", true);
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.settle(5, 8); // the new connection trails by 8 s
    t.tick();
    // 40 s on air, the new connection 8 s behind.
    expect(progressStore.getSnapshot().currentTrackProgress).toBe(32_000);
    vi.useRealTimers();
  });

  it("no song progress on the lock screen during a live program", async () => {
    const t = setup();
    t.repository.currentProgram = { name: "Live", dj: "DJ", isLive: true };
    t.repository.showProgress = false;
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    const nowPlaying = lastNowPlaying(t.player)!;
    expect(nowPlaying.duration).toBeUndefined();
    expect(nowPlaying.elapsed).toBeUndefined();
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

  it("an unknown heard title fetches fresh data (no timer) and falls back to the title", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.repository.refresh.mockClear();
    t.player.hear("Artist X - Live Hour | Show");
    expect(t.repository.expireStuckRefresh).toHaveBeenCalled();
    expect(t.repository.refresh).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(playerStore.getSnapshot().currentTrack?.raw).toBe("Artist X - Live Hour | Show"),
    );
    expect(lastNowPlaying(t.player)).toMatchObject({ artist: "Artist X" });
  });

  it("changing the stream re-tunes a loaded player, keeping the play intent", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.changeStream(STREAMS[1]);
    expect(t.player.load).not.toHaveBeenCalled(); // nothing loaded yet
    await t.service.play();
    t.player.setState("playing", true);
    await t.service.changeStream(STREAMS[0]);
    expect(t.player.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ uri: "https://stream.example/192" }),
      { autoplay: true },
    );
    expect(playerStore.getSnapshot().currentStream?.id).toBe("high");
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
    const progress = progressStore.getSnapshot().currentTrackProgress!;
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
    t.service.reportVisualizerDelay(120);
    expect(t.sampler.reportAppliedDelay).toHaveBeenCalledWith(120);
    t.service.setVisualizerSyncTrim(-40);
    expect(t.sampler.setSyncTrim).toHaveBeenCalledWith(-40);
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
});
