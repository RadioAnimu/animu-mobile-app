import { afterEach, describe, expect, it, vi } from "vitest";

// The factory wires real units around the native player — stub what reaches
// native modules or the network.
const { players, skew, prefetch, catalog, streams } = vi.hoisted(() => ({
  prefetch: vi.fn(),
  catalog: vi.fn(async (_items: unknown, _options: unknown) => {}),
  streams: [] as { id: string; url: string; bitrate: number }[],
  players: [] as {
    options: unknown;
    listeners: Map<string, (...args: unknown[]) => void>;
    setAudioSampling: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  }[],
  skew: { listener: null as ((skewMs: number, rttMs: number) => void) | null },
}));

vi.mock("react-native-anything-player", () => ({
  setCatalog: catalog,
  Player: class {
    listeners = new Map<string, (...args: unknown[]) => void>();
    setAudioSampling = vi.fn(() => true);
    released = false;
    release = vi.fn(async () => {
      this.released = true;
    });
    get isReleased() {
      return this.released;
    }
    load = vi.fn();
    play = vi.fn();
    pause = vi.fn();
    selectQuality = vi.fn();
    getProgress = vi.fn();
    updateNowPlaying = vi.fn(async () => {});
    status = { state: "idle", playWhenReady: false, network: "online" };
    constructor(public options: unknown) {
      players.push(this);
    }
    on(event: string, listener: (...args: unknown[]) => void) {
      this.listeners.set(event, listener);
      return () => this.listeners.delete(event);
    }
  },
}));
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
vi.mock("@/core/lyrics", () => ({ lyricsService: () => ({ prefetch }) }));
vi.mock("../../../api/client", () => ({
  setServerSkewListener: (listener: (skewMs: number, rttMs: number) => void) => {
    skew.listener = listener;
  },
  animuApi: { getStreams: vi.fn(async () => streams) },
}));

const load = async () => {
  vi.resetModules();
  players.length = 0;
  streams.length = 0;
  catalog.mockClear();
  // The shared player outlives a module re-run (Fast Refresh): a fresh app per test.
  (globalThis as { __animuPlayer?: unknown }).__animuPlayer = null;
  return import("@/core/player/player-factory");
};

describe("player factory", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // The catalog the app bundles (app.json's `catalog`: voice requests and cars
  // on a fresh install, before the app ever ran) is what the app publishes at
  // start with the fallback relays and the default quality. Regenerate it with
  // `CATALOG_SEED_WRITE=1 pnpm vitest run player-factory`.
  it("bundles the catalog the app publishes with the fallback relays", async () => {
    const { catalogFor } = await load();
    const { CONFIG } = await import("@/utils/player.config");
    const text = `${JSON.stringify(catalogFor(CONFIG.FALLBACK_STREAM_OPTIONS, CONFIG.DEFAULT_STREAM_OPTION), null, 2)}\n`;
    const file = new URL("../../../../rnap-catalog.json", import.meta.url);
    const fs = await import("node:fs");
    if (process.env.CATALOG_SEED_WRITE) fs.writeFileSync(file, text);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(JSON.parse(text));
  });

  it("creates the Airwave player with the app's options", async () => {
    const { createPlayerService } = await load();
    createPlayerService();
    expect(players).toHaveLength(1);
    expect(players[0].options).toEqual({
      id: "animu",
      diagnostics: expect.any(Boolean),
      metadata: { useStreamMetadataForNowPlaying: true },
      android: { stopOnTaskRemoved: true },
      progressInterval: 1_000,
    });
    expect([...players[0].listeners.keys()]).toEqual(
      expect.arrayContaining(["status", "metadata", "remoteCommand", "progress"]),
    );
    // Server clock samples reach the heard-track clock (no throw, any value).
    skew.listener?.(30_000, 100);
  });

  it("publishes the station for voice and cars: the app's own source, the pick, one car tab", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createPlayerService } = await load();
    const { streamSource } = await import("@/core/player/player-service");
    streams.push(
      { id: "320", url: "https://s.example/320", bitrate: 320 },
      { id: "64", url: "https://s.example/64", bitrate: 64 },
    );
    await createPlayerService().setupPlayer();
    expect(catalog).toHaveBeenCalledTimes(1);
    const [[item], options] = catalog.mock.calls[0] as [Record<string, unknown>[], Record<string, unknown>];
    expect(item).toMatchObject({
      id: "animu",
      title: "Rádio Animu",
      kind: "station",
      group: "Rádio Animu",
      quality: "320",
      source: streamSource(streams as never, streams[0] as never),
    });
    // A player native code creates behaves as the app's (the id is the catalog's own).
    const { id, ...playerOptions } = players[0].options as Record<string, unknown>;
    expect(id).toBe("animu");
    expect(options).toEqual({ playerId: "animu", playerOptions });
    quiet.mockRestore();
  });

  it("samples decoded audio through Airwave only once a visualizer listener reads windows", async () => {
    const { createPlayerService } = await load();
    const { WAVE_POINTS } = await import("@/core/player/visualizer/audio-sampler");
    const service = createPlayerService();
    const player = players[0];
    service.setVisualizerEnabled(true);
    player.listeners.get("status")?.({ state: "playing", playWhenReady: true, network: "online" });
    // Nothing is subscribed: nobody would see the windows, so no sampling.
    expect(player.setAudioSampling).not.toHaveBeenCalled();
    const unsubscribe = service.subscribeVisualizerWindows(() => {});
    expect(player.setAudioSampling).toHaveBeenLastCalledWith({ enabled: true, points: WAVE_POINTS });
    expect(player.listeners.has("audioSample")).toBe(true);
    // The listener leaving turns sampling back off.
    unsubscribe();
    expect(player.setAudioSampling).toHaveBeenLastCalledWith({ enabled: false, points: WAVE_POINTS });
    expect(player.listeners.has("audioSample")).toBe(false);
  });

  it("runs a 1 Hz foreground ticker once set up, stopped on teardown", async () => {
    vi.useFakeTimers();
    // The repository's first fetch fails against the stubbed service (logged).
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { createPlayerService } = await load();
    const service = createPlayerService();
    const ticks = () => setIntervalSpy.mock.calls.filter(([, ms]) => ms === 1_000).length;
    await service.setupPlayer();
    expect(ticks()).toBe(1);
    service.setAppActive(true); // already active: still one ticker
    expect(ticks()).toBe(1);
    service.setAppActive(false);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    service.setAppActive(true);
    expect(ticks()).toBe(2);
    await service.destroy();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    quiet.mockRestore();
  });

  it("keeps one service per app, recreated after teardown", async () => {
    const { playerService } = await load();
    const first = playerService();
    expect(playerService()).toBe(first);
    await first.destroy();
    const second = playerService();
    expect(second).not.toBe(first);
    expect(playerService()).toBe(second);
    expect(players[0].release).toHaveBeenCalled();
    // The released player is not reused.
    expect(players).toHaveLength(2);
  });

  it("a module re-run (Fast Refresh) takes the live player over, and only its new owner ends it", async () => {
    const { createPlayerService } = await load();
    const first = createPlayerService();
    // Fast Refresh: the module runs again, the first service is never torn down.
    vi.resetModules();
    const again = await import("@/core/player/player-factory");
    const second = again.createPlayerService();
    expect(players).toHaveLength(1);
    await first.destroy();
    expect(players[0].release).not.toHaveBeenCalled();
    await second.destroy();
    expect(players[0].release).toHaveBeenCalledTimes(1);
  });

  it("a remount during the native release gets a fresh service (not the disposed one)", async () => {
    const { playerService } = await load();
    const first = playerService();
    let finishRelease = () => {};
    players[0].release.mockImplementationOnce(() => new Promise<void>((resolve) => (finishRelease = resolve)));
    const destroyed = first.destroy();
    const second = playerService();
    expect(second).not.toBe(first);
    // The old teardown finishing late leaves its replacement in place.
    finishRelease();
    await destroyed;
    expect(playerService()).toBe(second);
  });
});
