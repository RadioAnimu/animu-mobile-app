import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioStatus } from "expo-audio";
import { setAudioModeAsync } from "expo-audio";
import { PlayerService, playerService } from "../player-service";
import { ArtworkResolver } from "../artwork";
import { HeartbeatScheduler } from "../heartbeat";
import { TransportStateMachine } from "../transport-state";
import { playerStore, progressStore } from "../store";
import type { PlayerServiceDependencies } from "../player-service";
import type { Track } from "../../domain/track";
import type { Stream } from "../../domain/stream";

// The orchestrator's module graph reaches react-native / expo native
// modules — stub them so the class under test can load in node. (vi.mock
// is hoisted above the imports.)
vi.mock("expo-audio", () => ({
  createAudioPlayer: vi.fn(() => ({
    addListener: () => ({ remove: () => {} }),
  })),
  setAudioModeAsync: vi.fn(),
}));
vi.mock("expo-asset", () => ({
  Asset: {
    fromModule: vi.fn(() => ({
      localUri: "file://mock/default-cover.png",
      downloadAsync: async () => ({ localUri: "file://mock/default-cover.png" }),
    })),
    fromURI: vi.fn((uri: string) => ({
      uri,
      localUri: "file://mock/artwork.png",
      downloadAsync: async () => ({ localUri: "file://mock/artwork.png" }),
    })),
  },
}));
vi.mock("expo-web-browser", () => ({ openBrowserAsync: vi.fn() }));
vi.mock("@react-native-community/netinfo", () => ({
  default: { addEventListener: () => () => {} },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("../../services/player-playback.service", () => ({
  StartPlaybackSession: vi.fn(async () => ({})),
  EndPlaybackSession: vi.fn(async () => {}),
  getPlaybackSession: vi.fn(() => null),
  setNowPlayingMetadata: vi.fn(),
  setRemotePlaybackStatus: vi.fn(),
}));
vi.mock("../../services/animu.service", () => ({
  animuService: { abortInFlightRequests: vi.fn() },
}));
vi.mock("../../../api/client", () => ({
  animuApi: {
    getStreams: vi.fn(async () => [
      { id: "low", url: "https://stream-low", bitrate: 64, category: "aac" },
    ]),
  },
  createMetadataClient: vi.fn(() => ({
    getStreamMetadata: async () => ({
      track: null,
      listeners: { value: 0 },
    }),
  })),
}));

const makeTrack = (): Track =>
  ({
    raw: "raw-1",
    anime: "Anime",
    artist: "Artist",
    artwork: "https://example.test/cover.png",
    duration: 100_000,
    startTime: new Date(),
  }) as unknown as Track;

/** Mutable fakes + the assembled dependency bag. Tests tweak fakes directly. */
const makeDeps = () => {
  const state = new TransportStateMachine();
  const transport = {
    setStatusHandler: vi.fn(),
    isSessionReady: true,
    hasPlayer: true,
    ensureSession: vi.fn(async () => {}),
    markSessionDown: vi.fn(),
    play: vi.fn(),
    load: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    dispose: vi.fn(),
  };
  const publisher = { push: vi.fn(), pushStatus: vi.fn() };
  const ticker = { tick: vi.fn(), reset: vi.fn() };
  const repository = {
    onChange: vi.fn(),
    currentTrack: makeTrack() as Track | null,
    currentProgram: { name: "P", dj: "D", isLive: false } as
      | { name: string; dj: string; isLive: boolean }
      | null,
    listeners: null,
    lastPlayedTracks: [] as Track[],
    lastRequestedTracks: [] as Track[],
    hasTrack: true,
    showProgress: false,
    refresh: vi.fn(async () => false),
    refreshHistory: vi.fn(async () => {}),
    expireStuckRefresh: vi.fn(),
    dispose: vi.fn(),
    clear: vi.fn(),
    setShowProgress: vi.fn(),
  };
  const streamPreferences = {
    current: { id: "low", url: "https://stream", label: "Low" },
    load: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    set: vi.fn(async () => {}),
    reset: vi.fn(),
  };
  const reconnect = {
    cancel: vi.fn(),
    reset: vi.fn(),
    schedule: vi.fn(() => 2000),
    isPending: false,
    attemptCount: 0,
  };
  const networkMonitor = { onRestore: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const heartbeat = new HeartbeatScheduler({
    repository,
    ticker,
    isPlayingIntent: () => state.isPlayingIntent,
    stateLabel: () => state.state,
  });
  const artwork = new ArtworkResolver();

  const deps = {
    state,
    transport,
    publisher,
    repository,
    streamPreferences,
    reconnect,
    networkMonitor,
    ticker,
    heartbeat,
    artwork,
  } as unknown as PlayerServiceDependencies;

  return { deps, transport, publisher, repository, reconnect };
};

const wiredHandler = (transport: {
  setStatusHandler: ReturnType<typeof vi.fn>;
}): ((status: AudioStatus) => void) =>
  transport.setStatusHandler.mock.calls[0][0] as (status: AudioStatus) => void;

describe("PlayerService store emission", () => {
  beforeEach(() => {
    // Reset singletons between tests
    playerStore.setSnapshot({
      isPlaying: false,
      playbackState: "idle",
      isInitialized: false,
    });
    progressStore.setSnapshot({
      currentTrackProgress: null,
      showProgress: false,
    });
  });

  it("play() then pause() flips isPlaying in the player store", async () => {
    const { deps } = makeDeps();
    const service = new PlayerService(deps);
    const seen: boolean[] = [];
    const unsubscribe = playerStore.subscribe(() => {
      seen.push(playerStore.getSnapshot().isPlaying);
    });

    await service.play();
    await service.pause();
    unsubscribe();

    expect(playerStore.getSnapshot().isPlaying).toBe(false);
    expect(seen).toContain(true);
    expect(seen[seen.length - 1]).toBe(false);
  });

  it("pause() reaches the transport even without track data", async () => {
    const { deps, repository, transport, publisher } = makeDeps();
    repository.currentTrack = null;
    repository.hasTrack = false;

    const service = new PlayerService(deps);
    await service.play();
    await service.pause();

    expect(transport.pause).toHaveBeenCalledTimes(1);
    expect(deps.state.state).toBe("paused");
    expect(publisher.pushStatus).toHaveBeenCalledWith("paused");
  });

  it("pause() is a no-op without a native player", async () => {
    const { deps, transport } = makeDeps();
    transport.hasPlayer = false;

    const service = new PlayerService(deps);
    await service.pause();

    expect(transport.pause).not.toHaveBeenCalled();
    expect(deps.state.state).toBe("idle");
  });

  it("pause() cancels pending reconnects before pausing", async () => {
    const { deps, reconnect, transport } = makeDeps();
    const service = new PlayerService(deps);

    await service.play();
    await service.pause();

    expect(reconnect.cancel).toHaveBeenCalled();
    expect(transport.pause).toHaveBeenCalled();
  });
});

describe("PlayerService stream-loss handling", () => {
  it("schedules a reconnect when the stream dies after the grace window", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, reconnect } = makeDeps();
      const service = new PlayerService(deps);

      // Intent chain: play() → connecting → native reports audio flowing
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioStatus);

      // …then the stream dies after the 3s grace window
      vi.advanceTimersByTime(4000);
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "idle",
      } as AudioStatus);

      expect(reconnect.schedule).toHaveBeenCalledTimes(1);
      expect(deps.state.state).toBe("reconnecting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores transient idle states inside the grace window", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport } = makeDeps();
      const service = new PlayerService(deps);

      // replace() emits a brief "idle" right after play() — must NOT
      // be treated as a dead stream
      await service.play();
      const handler = wiredHandler(transport);
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "idle",
      } as AudioStatus);

      expect(deps.state.state).toBe("connecting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells the media session 'playing' again right after a reconnect", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, publisher } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);

      handler({ playing: true } as AudioStatus); // recovery push #1
      vi.advanceTimersByTime(4000);
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "idle",
        timeControlStatus: "paused",
      } as AudioStatus); // dead → "buffering"
      handler({ playing: true } as AudioStatus); // recovered → "playing"

      const statuses = publisher.pushStatus.mock.calls.map(
        (call) => call[0],
      );
      expect(statuses[statuses.length - 1]).toBe("playing");
      // The death and the recovery were both pushed immediately — no
      // waiting for the next track change (the live-stream dedupe bug).
      expect(statuses).toContain("buffering");
      expect(deps.state.state).toBe("playing");
      expect(playerStore.getSnapshot().isPlaying).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("adopts a native pause (focus loss, interruption) into the stores", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, publisher } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioStatus);

      // Audio focus lost — expo-audio pauses natively and reports it
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "ready",
        timeControlStatus: "paused",
      } as AudioStatus);

      expect(deps.state.state).toBe("paused");
      expect(playerStore.getSnapshot().isPlaying).toBe(false);
      expect(playerStore.getSnapshot().playbackState).toBe("paused");
      expect(publisher.pushStatus).toHaveBeenLastCalledWith("paused");
      expect(transport.pause).not.toHaveBeenCalled(); // native already did
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-asserts the user's pause when audio self-recovers", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      await service.pause(); // user's explicit intent
      const pauseCalls = transport.pause.mock.calls.length;

      // A straggler playing event (or rare auto-resume) must not
      // resurrect audio against the user's intent
      handler({ playing: true } as AudioStatus);

      expect(deps.state.state).toBe("paused");
      expect(transport.pause).toHaveBeenCalledTimes(pauseCalls + 1);
      expect(playerStore.getSnapshot().isPlaying).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a cleanly ended live stream as a dead stream", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, reconnect } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioStatus);
      vi.advanceTimersByTime(4000);

      handler({
        playing: false,
        isBuffering: false,
        playbackState: "ended",
        timeControlStatus: "paused",
      } as AudioStatus);

      expect(reconnect.schedule).toHaveBeenCalledTimes(1);
      expect(deps.state.state).toBe("reconnecting");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("PlayerService lifecycle", () => {
  it("dedupes concurrent setupPlayer() calls into one native setup", async () => {
    const { animuApi } = await import("../../../api/client");
    const first = playerService();

    await Promise.all([first.setupPlayer(), first.setupPlayer()]);

    expect(animuApi.getStreams).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(playerStore.getSnapshot().isInitialized).toBe(true);

    await first.destroy();
    expect(playerStore.getSnapshot().isInitialized).toBe(false);
  });

  it("destroy() on a never-set-up instance still releases the singleton", async () => {
    const first = playerService();
    await first.destroy(); // never set up — must not early-return silently

    const second = playerService();
    expect(second).not.toBe(first);
    expect(playerStore.getSnapshot().isInitialized).toBe(false);
    await second.destroy();
  });

  it("destroy() during an in-flight setup prevents initialization", async () => {
    const { animuApi } = await import("../../../api/client");
    let resolveStreams!: (streams: Stream[]) => void;
    vi.mocked(animuApi.getStreams).mockImplementationOnce(
      () =>
        new Promise<Stream[]>((resolve) => {
          resolveStreams = resolve;
        }),
    );

    const svc = playerService();
    const setup = svc.setupPlayer();

    // Unmount while Phase 1 is awaiting the streams fetch
    await svc.destroy();
    resolveStreams([]);
    await setup;

    // The orphaned bootstrap must never mark the app initialized
    expect(playerStore.getSnapshot().isInitialized).toBe(false);
  });

  it("changeStream swaps the source without track data (hasPlayer, not isReady)", async () => {
    const { deps, transport, repository } = makeDeps();
    repository.hasTrack = false;
    repository.currentTrack = null;

    const service = new PlayerService(deps);
    await service.play();
    transport.load.mockClear();

    await service.changeStream({
      id: "high",
      url: "https://stream-high",
      bitrate: 256,
      category: "aac",
    } as Stream);

    expect(transport.load).toHaveBeenCalledWith("https://stream-high");
  });
});

describe("PlayerService heartbeat", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("gates the two drivers into a 1 Hz heartbeat", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { deps, transport } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      const base = Date.now();

      // Native event processed…
      vi.setSystemTime(base + 10_000);
      handler({ playing: true } as AudioStatus);
      expect(deps.ticker.tick).toHaveBeenCalledTimes(1);

      // …JS task 300ms later is gated (< 800ms since last beat)
      service.heartbeat();
      expect(deps.ticker.tick).toHaveBeenCalledTimes(1);

      // …next native event a second later processes again
      vi.setSystemTime(base + 11_200);
      handler({ playing: true } as AudioStatus);
      expect(deps.ticker.tick).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs the refresh watchdog on every processed heartbeat", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { deps, transport, repository } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      const base = Date.now();

      vi.setSystemTime(base + 10_000);
      handler({ playing: true } as AudioStatus);

      expect(repository.expireStuckRefresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drives the data poll from native heartbeats every 5s of audio", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { deps, transport, repository } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const pollsFromPlay = vi.mocked(repository.refresh).mock.calls.length;

      const handler = wiredHandler(transport);
      const base = Date.now();
      // 10s of audio at 1 Hz → polls at heartbeat 5 and 10
      for (let i = 1; i <= 10; i++) {
        vi.setSystemTime(base + 10_000 + i * 1000);
        handler({ playing: true } as AudioStatus);
      }
      await flush();

      expect(vi.mocked(repository.refresh).mock.calls.length).toBe(
        pollsFromPlay + 2,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops heartbeat polling once destroyed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { deps, transport, repository } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const pollsFromPlay = vi.mocked(repository.refresh).mock.calls.length;
      await service.destroy();

      const handler = wiredHandler(transport);
      vi.setSystemTime(Date.now() + 60_000);
      handler({ playing: true } as AudioStatus);

      // No new polls or ticks may happen on a destroyed instance
      expect(vi.mocked(repository.refresh).mock.calls.length).toBe(
        pollsFromPlay,
      );
      expect(deps.ticker.tick).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
