import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MediaMetadata,
  NowPlayingMetadata as AirwaveNowPlaying,
  PlaybackState,
  PlayerEventMap,
  PlayerStatus,
} from "react-native-airwave";
import { PlayerService, type PlayerServiceDependencies } from "@/core/player/player-service";
import { HeardTrack, ICY_AFTER_START_MS } from "@/core/player/stream-playback/heard-track";
import { playerStore, progressStore } from "@/core/player/store";
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

const setup = () => {
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
    sampler,
    stats,
    ticker,
    onDestroyed,
  } as unknown as PlayerServiceDependencies);
  return {
    service,
    player,
    repository,
    preferences,
    artwork,
    sampler,
    stats,
    ticker,
    onDestroyed,
    tick: () => tick?.(),
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

describe("PlayerService on react-native-airwave", () => {
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

  it("tune-in: the first heard title is placed partway (station time minus lag)", async () => {
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("buffering", true);
    t.player.setState("playing", true);
    expect(playerStore.getSnapshot().syncing).toBe(true);
    t.player.hear("Song A");
    // On air for 30 s at the live edge; the speaker trails by 6 s.
    const progress = progressStore.getSnapshot().currentTrackProgress!;
    expect(progress).toBeGreaterThanOrEqual(23_900);
    expect(progress).toBeLessThan(24_500);
    expect(playerStore.getSnapshot().syncing).toBe(false);
    const nowPlaying = lastNowPlaying(t.player)!;
    expect(nowPlaying).toMatchObject({
      title: "Song A (anime)",
      artist: "Artist",
      duration: 200,
    });
    expect(nowPlaying.elapsed).toBeCloseTo(progress / 1000, 0);
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
    const t = setup();
    await t.service.setupPlayer();
    await t.service.play();
    t.player.setState("playing", true);
    t.player.hear("Song A");
    t.player.setState("reconnecting", true);
    expect(playerStore.getSnapshot().syncing).toBe(true);
    expect(progressStore.getSnapshot().currentTrackProgress).toBeNull();
    t.player.setState("loading", true);
    t.player.setState("playing", true);
    t.player.hear("Song A");
    expect(progressStore.getSnapshot().currentTrackProgress).toBeGreaterThan(20_000);
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
