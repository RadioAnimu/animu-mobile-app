import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAudioModeAsync } from "expo-audio";
import { PlayerService, playerService } from "@/core/player/player-service";
import { ArtworkResolver } from "@/core/player/storage/artwork";
import { HeartbeatScheduler } from "@/core/player/stream-playback/heartbeat";
import { TransportStateMachine } from "@/core/player/stream-playback/transport-state";
import { playerStore, progressStore } from "@/core/player/store";
import type { PlayerServiceDependencies } from "@/core/player/player-service";
import type { AudioPlaybackStatus } from "@/core/player/ports";
import type { Track } from "@/core/domain/track";
import type { Stream } from "@/core/domain/stream";

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
// The artwork resolver now reaches expo-file-system; failing download
// keeps tests on the expo-asset fallback path this suite asserts.
vi.mock("expo-file-system", () => ({
  File: Object.assign(
    function (this: { exists: boolean; size: number; uri: string }, dir: unknown, name: string) {
      void dir;
      this.exists = false;
      this.size = 0;
      this.uri = `file://mock/cache/${name}`;
    },
    {
      downloadFileAsync: vi.fn(async () => {
        throw new Error("direct download disabled in test");
      }),
    },
  ),
  Paths: { cache: "file://mock/cache" },
}));
vi.mock("expo-image", () => ({
  Image: { getCachePathAsync: vi.fn(), writeToCacheAsync: vi.fn() },
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: { addEventListener: () => () => {} },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("react-native-playback-controls", () => ({
  PlaybackControls: {
    startSession: vi.fn(async () => ({
      isEnded: false,
      addCommandListener: () => ({ remove: () => {} }),
      setNowPlaying: vi.fn(),
      setPlaybackState: vi.fn(),
      end: async () => {},
    })),
  },
}));
vi.mock("../../services/animu.service", () => ({
  animuService: { abortInFlightRequests: vi.fn() },
}));
vi.mock("../../../api/client", () => ({
  setServerSkewListener: vi.fn(),
  animuApi: {
    getStreams: vi.fn(async () => [
      { id: "low", url: "https://stream-low", bitrate: 64, category: "aac" },
    ]),
  },
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
    isSamplingSupported: false,
    hasPlayer: true,
    ensureAudioMode: vi.fn(async () => {}),
    play: vi.fn(),
    load: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    setSamplingEnabled: vi.fn(),
    onSample: vi.fn(() => () => {}),
    startKeepalive: vi.fn(),
    stopKeepalive: vi.fn(),
    dispose: vi.fn(),
  };
  const publisher = {
    setHandlers: vi.fn(),
    start: vi.fn(async () => true),
    isActive: true,
    push: vi.fn(),
    pushStatus: vi.fn(),
    end: vi.fn(async () => {}),
  };
  const ticker = { tick: vi.fn(), setUiVisible: vi.fn(), reset: vi.fn() };
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
    startLive: vi.fn(),
    stopLive: vi.fn(),
    setLiveStreamActive: vi.fn(),
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
  const networkMonitor = {
    onRestore: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    isOnline: vi.fn(() => true),
  };
  const heartbeat = new HeartbeatScheduler({
    repository,
    ticker,
    isPlayingIntent: () => state.isPlayingIntent,
    stateLabel: () => state.state,
  });
  const artwork = new ArtworkResolver();
  const sync = {
    now: () => Date.now(),
    updateFromStatus: vi.fn(),
    updateFromAnchor: vi.fn(),
    reset: vi.fn(),
    isAudible: vi.fn(() => true),
    isStale: vi.fn(() => false),
    delay: 0,
    hasMeasurement: false,
    settled: true,
    lastAnchor: null,
  };
  const audible = {
    onChange: vi.fn(),
    // By default the displayed track mirrors the station's, so tests that
    // set `repository.currentTrack` see it in the now-playing surfaces.
    get track() {
      return repository.currentTrack;
    },
    reconcile: vi.fn(() => false),
    adoptIfDue: vi.fn(),
    beginReacquire: vi.fn(),
    reset: vi.fn(),
  };
  const sampler = {
    isSupported: true,
    isActive: false,
    setHz: vi.fn(),
    setForeground: vi.fn(),
    setPlaying: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  };

  const deps = {
    state,
    audio: transport,
    sampler,
    media: publisher,
    repository,
    streamPreferences,
    reconnect,
    networkMonitor,
    ticker,
    heartbeat,
    artwork,
    sync,
    audible,
  } as unknown as PlayerServiceDependencies;

  return {
    deps,
    transport,
    publisher,
    repository,
    reconnect,
    sampler,
    sync,
    audible,
    networkMonitor,
  };
};

const wiredHandler = (transport: {
  setStatusHandler: ReturnType<typeof vi.fn>;
}): ((status: AudioPlaybackStatus) => void) =>
  transport.setStatusHandler.mock.calls[0][0] as (
    status: AudioPlaybackStatus,
  ) => void;

describe("PlayerService store emission", () => {
  beforeEach(() => {
    // Reset singletons between tests
    playerStore.setSnapshot({
      isPlaying: false,
      playbackState: "idle",
      isInitialized: false,
      syncing: false,
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

  it("enters the calculating state on the first play and clears once settled", async () => {
    const { deps, transport } = makeDeps();
    // The real engine starts unmeasured; the fake defaults to settled.
    (deps.sync as unknown as { settled: boolean }).settled = false;
    const service = new PlayerService(deps);

    // First play: the native status listener attaches now, so the store is
    // in "calculating" from this press until the estimate settles.
    await service.play();
    expect(playerStore.getSnapshot().syncing).toBe(true);

    // A native status frame arrives after the engine has settled.
    (deps.sync as unknown as { settled: boolean }).settled = true;
    wiredHandler(transport)({ playing: true } as AudioPlaybackStatus);

    expect(playerStore.getSnapshot().syncing).toBe(false);
  });

  it("re-syncs on resume when the retained clock is stale", async () => {
    const { deps, sync, audible } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();

    // A long pause / background gap: the estimate is stale.
    (sync as unknown as { hasMeasurement: boolean }).hasMeasurement = true;
    (sync as unknown as { isStale: ReturnType<typeof vi.fn> }).isStale
      .mockReturnValue(true);
    sync.reset.mockClear();
    audible.beginReacquire.mockClear();

    await service.play();

    expect(sync.reset).toHaveBeenCalledTimes(1);
    expect(audible.beginReacquire).toHaveBeenCalledTimes(1);
  });

  it("stays seamless on a short resume with a fresh clock", async () => {
    const { deps, sync, audible } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();

    (sync as unknown as { hasMeasurement: boolean }).hasMeasurement = true;
    (sync as unknown as { isStale: ReturnType<typeof vi.fn> }).isStale
      .mockReturnValue(false);
    sync.reset.mockClear();
    audible.beginReacquire.mockClear();

    await service.play();

    expect(sync.reset).not.toHaveBeenCalled();
    expect(audible.beginReacquire).not.toHaveBeenCalled();
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
      handler({ playing: true } as AudioPlaybackStatus);

      // …then the stream dies after the 3s grace window
      vi.advanceTimersByTime(4000);
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "idle",
      } as AudioPlaybackStatus);

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
      } as AudioPlaybackStatus);

      expect(deps.state.state).toBe("connecting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not claim 'playing' while the native player is buffering", async () => {
    const { deps, transport, publisher } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();
    const handler = wiredHandler(transport);

    // expo-audio 57 (Android) reports `playing: true` (the intended state)
    // while buffering. Buffering is not audio flow: the service must stay in
    // a buffering transport state and must never push "playing" to the OS.
    handler({
      playing: true,
      isBuffering: true,
      timeControlStatus: "playing",
      playbackState: "buffering",
    } as AudioPlaybackStatus);

    expect(deps.state.state).toBe("connecting");
    const statuses = publisher.pushStatus.mock.calls.map((call) => call[0]);
    expect(statuses).not.toContain("playing");

    // …and once audio actually flows it adopts "playing" as usual.
    handler({ playing: true, isBuffering: false } as AudioPlaybackStatus);
    expect(deps.state.state).toBe("playing");
  });

  it("tells the media session 'playing' again right after a reconnect", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, publisher } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);

      handler({ playing: true } as AudioPlaybackStatus); // recovery push #1
      vi.advanceTimersByTime(4000);
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "idle",
        timeControlStatus: "paused",
      } as AudioPlaybackStatus); // dead → "buffering"
      handler({ playing: true } as AudioPlaybackStatus); // recovered → "playing"

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
      handler({ playing: true } as AudioPlaybackStatus);

      // Audio focus lost — expo-audio pauses natively and reports it
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "ready",
        timeControlStatus: "paused",
      } as AudioPlaybackStatus);

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
      handler({ playing: true } as AudioPlaybackStatus);

      expect(deps.state.state).toBe("paused");
      expect(transport.pause).toHaveBeenCalledTimes(pauseCalls + 1);
      expect(playerStore.getSnapshot().isPlaying).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-opens the live edge on a native auto-resume after a real interruption", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, publisher } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioPlaybackStatus);
      transport.play.mockClear();

      // Phone call: expo-audio pauses natively while audio is flowing.
      handler({
        playing: false,
        isBuffering: false,
        playbackState: "ready",
        timeControlStatus: "paused",
      } as AudioPlaybackStatus);
      expect(deps.state.state).toBe("paused");

      // Call ends and the OS resumes on its own — re-open at the live edge
      // instead of replaying the stale buffered position.
      handler({ playing: true } as AudioPlaybackStatus);

      expect(transport.play).toHaveBeenCalledWith(
        deps.streamPreferences.current.url,
      );
      expect(deps.state.state).toBe("connecting");
      expect(playerStore.getSnapshot().isPlaying).toBe(true);
      expect(publisher.pushStatus).toHaveBeenLastCalledWith("buffering");
      // The transport was never told to pause — this was not the user.
      expect(transport.pause).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not re-open on the paused→playing transient of a stream change", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioPlaybackStatus);

      // Manual re-tune: state becomes "connecting" while replace() runs,
      // then the native layer emits a transient paused frame + playing.
      await service.changeStream({
        id: "high",
        url: "https://stream-high",
        bitrate: 320,
        category: "mp3",
      } as unknown as Stream);
      transport.play.mockClear();

      handler({
        playing: false,
        isBuffering: false,
        playbackState: "ready",
        timeControlStatus: "paused",
      } as AudioPlaybackStatus);
      handler({ playing: true } as AudioPlaybackStatus);

      expect(transport.play).not.toHaveBeenCalled();
      expect(deps.state.state).toBe("playing");
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
      handler({ playing: true } as AudioPlaybackStatus);
      vi.advanceTimersByTime(4000);

      handler({
        playing: false,
        isBuffering: false,
        playbackState: "ended",
        timeControlStatus: "paused",
      } as AudioPlaybackStatus);

      expect(reconnect.schedule).toHaveBeenCalledTimes(1);
      expect(deps.state.state).toBe("reconnecting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-opens the live edge when a long buffering stall recovers", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport, publisher } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioPlaybackStatus);
      transport.play.mockClear();

      // The link degrades but Wi-Fi stays associated: the native player
      // stalls (buffering) without the stream ever dying.
      handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
      expect(deps.state.state).toBe("connecting");

      // 4s behind live — longer than the drift threshold.
      vi.advanceTimersByTime(4000);

      // The link recovers. The native player would drain its stale buffer
      // and stay behind live; the service must re-open at the live edge.
      handler({ playing: true, isBuffering: false } as AudioPlaybackStatus);

      expect(transport.play).toHaveBeenCalledWith(
        deps.streamPreferences.current.url,
      );
      expect(deps.state.state).toBe("connecting");
      expect(publisher.pushStatus).toHaveBeenLastCalledWith("buffering");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the buffered position when a short stall recovers", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      handler({ playing: true } as AudioPlaybackStatus);
      transport.play.mockClear();

      // A sub-threshold blip: no re-open, the native player catches up.
      handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
      vi.advanceTimersByTime(500);
      handler({ playing: true, isBuffering: false } as AudioPlaybackStatus);

      expect(transport.play).not.toHaveBeenCalled();
      expect(deps.state.state).toBe("playing");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("PlayerService background-outage recovery", () => {
  it("starts the keepalive when backgrounded with audio wanted but stalled", async () => {
    const { deps, transport } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();
    const handler = wiredHandler(transport);
    handler({ playing: true } as AudioPlaybackStatus);

    // Audio flowing → nothing to keep alive.
    service.setAppActive(false);
    expect(transport.startKeepalive).not.toHaveBeenCalled();

    // The link dies in the background: audio wanted, not flowing — the
    // silent loop must render so iOS does not suspend the app mid-outage.
    handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
    expect(transport.startKeepalive).toHaveBeenCalled();
    expect(deps.state.state).toBe("connecting");
  });

  it("stops the keepalive once audio flows again", async () => {
    const { deps, transport } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();
    const handler = wiredHandler(transport);
    handler({ playing: true } as AudioPlaybackStatus);
    service.setAppActive(false);
    handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
    transport.stopKeepalive.mockClear();

    handler({ playing: true, isBuffering: false } as AudioPlaybackStatus);
    expect(transport.stopKeepalive).toHaveBeenCalled();
  });

  it("stops the keepalive and reconnects when the app is foregrounded mid-outage", async () => {
    const { deps, transport } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();
    const handler = wiredHandler(transport);
    handler({ playing: true } as AudioPlaybackStatus);
    service.setAppActive(false);
    handler({ playing: true, isBuffering: true } as AudioPlaybackStatus); // stalled, keepalive on
    transport.play.mockClear();
    transport.stopKeepalive.mockClear();

    // The user opens the app: audio is still wanted but not flowing — the
    // suspension catch-up must reconnect NOW (the backoff timer is stale).
    service.setAppActive(true);

    expect(transport.stopKeepalive).toHaveBeenCalled();
    expect(transport.play).toHaveBeenCalledWith(
      deps.streamPreferences.current.url,
    );
    expect(deps.state.state).toBe("connecting");
  });

  it("never starts the keepalive after an explicit user pause", async () => {
    const { deps, transport } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();
    await service.pause();
    transport.startKeepalive.mockClear();

    service.setAppActive(false);
    expect(transport.startKeepalive).not.toHaveBeenCalled();
  });

  it("escalates a stuck connecting transport from resume() to a source re-open", async () => {
    vi.useFakeTimers();
    try {
      const { deps, transport } = makeDeps();
      const service = new PlayerService(deps);
      await service.play();
      const handler = wiredHandler(transport);
      transport.resume.mockClear();
      transport.play.mockClear();

      // The socket is broken: the player keeps reporting buffering forever
      // (AVPlayer does not resume a dead progressive stream by itself).
      handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);

      // Window 1 and 2: cheap native starts only.
      vi.advanceTimersByTime(4000);
      handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
      vi.advanceTimersByTime(4000);
      handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
      expect(transport.resume).toHaveBeenCalledTimes(2);
      expect(transport.play).not.toHaveBeenCalled();

      // Window 3: resume() clearly isn't taking — re-open the source.
      vi.advanceTimersByTime(4000);
      handler({ playing: true, isBuffering: true } as AudioPlaybackStatus);
      expect(transport.play).toHaveBeenCalledWith(
        deps.streamPreferences.current.url,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("PlayerService lifecycle", () => {
  it("dedupes concurrent setupPlayer() calls into one native setup", async () => {
    const { animuApi } = await import("@/api/client");
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
    const { animuApi } = await import("@/api/client");
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

  it("changeStream keeps the displayed track on screen (offline-safe)", async () => {
    const { deps, audible } = makeDeps();
    const service = new PlayerService(deps);
    await service.play();
    audible.reset.mockClear();
    audible.beginReacquire.mockClear();

    await service.changeStream({
      id: "high",
      url: "https://stream-high",
      bitrate: 256,
      category: "aac",
    } as Stream);

    // Resetting the resolver would blank the now-playing UI if the follow-up
    // fetch fails (offline re-tune).
    expect(audible.reset).not.toHaveBeenCalled();
    // …but the re-tune must hold the displayed track until the new relay's
    // lag is measured (the new relay is still behind on the previous song).
    expect(audible.beginReacquire).toHaveBeenCalledTimes(1);
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
      handler({ playing: true } as AudioPlaybackStatus);
      expect(deps.ticker.tick).toHaveBeenCalledTimes(1);

      // …JS task 300ms later is gated (< 800ms since last beat)
      service.heartbeat();
      expect(deps.ticker.tick).toHaveBeenCalledTimes(1);

      // …next native event a second later processes again
      vi.setSystemTime(base + 11_200);
      handler({ playing: true } as AudioPlaybackStatus);
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
      handler({ playing: true } as AudioPlaybackStatus);

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
        handler({ playing: true } as AudioPlaybackStatus);
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
      handler({ playing: true } as AudioPlaybackStatus);

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

describe("PlayerService updateMetadata", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("does not re-enter itself when the artwork is already local (covers off)", async () => {
    const { deps, publisher, repository } = makeDeps();
    // Covers OFF → selectArtwork returns the bundled default cover, which
    // resolves to a local file URI — resolve() passes it through untracked.
    repository.currentTrack = {
      ...makeTrack(),
      artwork: "file://bundled/default-cover.png",
    } as Track;
    const service = new PlayerService(deps);

    await service.updateMetadata();
    await flush();

    // Exactly the initial push — the old "re-push until peek hits" logic
    // looped forever and wedged the JS thread.
    expect(publisher.push).toHaveBeenCalledTimes(1);
  });

  it("re-pushes once (and terminates) when a remote cover resolves locally", async () => {
    // The media session reads the app's own local file — the second push
    // swaps the remote URL for the resolved `file://` URI — on every
    // platform (the patched native module publishes the bytes inline).
    const { deps, publisher, repository } = makeDeps();
    repository.currentTrack = {
      ...makeTrack(),
      artwork: "https://images.test/cover.png",
    } as Track;
    const service = new PlayerService(deps);

    await service.updateMetadata();
    await flush();

    // Initial push + the swapped-file re-push once the download lands — no
    // unbounded recursion when the resolve succeeds.
    expect(publisher.push).toHaveBeenCalledTimes(2);
    // Only one download was kicked off.
    expect(deps.artwork.peek("https://images.test/cover.png")).toBe(
      "file://mock/artwork.png",
    );
  });

  it("terminates (no re-download storm) when a remote cover download fails", async () => {
    const { deps, publisher, repository } = makeDeps();
    repository.currentTrack = {
      ...makeTrack(),
      artwork: "https://images.test/failing.png",
    } as Track;
    const service = new PlayerService(deps);

    // Simulate a failed download: resolve() degrades to the remote URL and
    // never tracks it, so peek() stays undefined forever. The pre-fix code
    // re-entered updateMetadata() until it wedged the JS thread.
    const resolveSpy = vi
      .spyOn(deps.artwork, "resolve")
      .mockImplementation(async (url) => url);

    await service.updateMetadata();
    await flush();
    await flush();

    // One resolve attempt + the initial push + exactly ONE settle push —
    // bounded, no recursion.
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(publisher.push).toHaveBeenCalledTimes(2);

    resolveSpy.mockRestore();
  });
});

describe("PlayerService artwork prefetch", () => {
  const change = {
    trackChanged: true,
    programChanged: false,
    listenersChanged: false,
    playedChanged: false,
    requestedChanged: false,
  };

  it("warms the announced cover while the previous track is still heard", async () => {
    const { deps, repository, audible } = makeDeps();
    // The speaker is still on the previous track (audible resolver deferred).
    Object.defineProperty(audible, "track", {
      configurable: true,
      get: () =>
        ({
          ...makeTrack(),
          raw: "previous",
          artwork: "https://images.test/previous.png",
        }) as Track,
    });
    new PlayerService(deps);
    const resolveSpy = vi
      .spyOn(deps.artwork, "resolve")
      .mockImplementation(async (url) => url);

    repository.currentTrack = {
      ...makeTrack(),
      raw: "next",
      artwork: "https://images.test/next.png",
    } as Track;
    repository.onChange(change);

    // The prefetch resolves the *announced* track, not the displayed one.
    expect(resolveSpy).toHaveBeenCalledWith("https://images.test/next.png");
  });

  it("does not prefetch local/bundled artwork", () => {
    const { deps, repository } = makeDeps();
    new PlayerService(deps);
    const resolveSpy = vi
      .spyOn(deps.artwork, "resolve")
      .mockImplementation(async (url) => url);

    repository.currentTrack = {
      ...makeTrack(),
      artwork: "file://bundled/default-cover.png",
    } as Track;
    repository.onChange(change);

    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("skips the prefetch when the cover is already cached", () => {
    const { deps, repository } = makeDeps();
    new PlayerService(deps);
    vi.spyOn(deps.artwork, "peek").mockReturnValue("file://mock/cached.jpg");
    const resolveSpy = vi
      .spyOn(deps.artwork, "resolve")
      .mockImplementation(async (url) => url);

    repository.currentTrack = {
      ...makeTrack(),
      artwork: "https://images.test/cached.png",
    } as Track;
    repository.onChange(change);

    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("skips the prefetch while the link is known-down", () => {
    const { deps, repository, audible, networkMonitor } = makeDeps();
    // The displayed track is local, so only the prefetch could resolve.
    Object.defineProperty(audible, "track", {
      configurable: true,
      get: () =>
        ({
          ...makeTrack(),
          raw: "previous",
          artwork: "file://local/previous.jpg",
        }) as Track,
    });
    new PlayerService(deps);
    vi.mocked(networkMonitor.isOnline).mockReturnValue(false);
    const resolveSpy = vi
      .spyOn(deps.artwork, "resolve")
      .mockImplementation(async (url) => url);

    repository.currentTrack = {
      ...makeTrack(),
      raw: "next",
      artwork: "https://images.test/next.png",
    } as Track;
    repository.onChange(change);

    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("prefetches the low-res sibling alongside the full cover", () => {
    const { deps, repository, audible } = makeDeps();
    // The displayed track is local, so only the prefetch could resolve.
    Object.defineProperty(audible, "track", {
      configurable: true,
      get: () =>
        ({
          ...makeTrack(),
          raw: "previous",
          artwork: "file://local/previous.jpg",
        }) as Track,
    });
    new PlayerService(deps);
    const resolveSpy = vi
      .spyOn(deps.artwork, "resolve")
      .mockImplementation(async (url) => url);

    repository.currentTrack = {
      ...makeTrack(),
      raw: "next",
      artwork: "https://images.test/next_large.png",
      artworks: {
        tiny: "https://images.test/next_tiny.png",
        large: "https://images.test/next_large.png",
      },
    } as unknown as Track;
    repository.onChange(change);

    const resolvedUrls = resolveSpy.mock.calls.map((call) => call[0]);
    expect(resolvedUrls).toContain("https://images.test/next_large.png");
    expect(resolvedUrls).toContain("https://images.test/next_tiny.png");
  });
});
