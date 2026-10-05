import { afterEach, describe, expect, it, vi } from "vitest";

// The factory wires real units around the native player — stub what reaches
// native modules or the network.
const { players, skew } = vi.hoisted(() => ({
  players: [] as {
    options: unknown;
    listeners: Map<string, (...args: unknown[]) => void>;
    setAudioSampling: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  }[],
  skew: { listener: null as ((skewMs: number, rttMs: number) => void) | null },
}));

vi.mock("react-native-airwave", () => ({
  Player: class {
    listeners = new Map<string, (...args: unknown[]) => void>();
    setAudioSampling = vi.fn(() => true);
    release = vi.fn(async () => {});
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
vi.mock("../../../api/client", () => ({
  setServerSkewListener: (listener: (skewMs: number, rttMs: number) => void) => {
    skew.listener = listener;
  },
  animuApi: { getStreams: vi.fn(async () => []) },
}));

const load = async () => {
  vi.resetModules();
  players.length = 0;
  return import("@/core/player/player-factory");
};

describe("player factory", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates the Airwave player with the app's options", async () => {
    const { createPlayerService } = await load();
    createPlayerService();
    expect(players).toHaveLength(1);
    expect(players[0].options).toEqual({
      diagnostics: expect.any(Boolean),
      metadata: { useStreamMetadataForNowPlaying: false },
      android: { stopOnTaskRemoved: true },
      progressInterval: 1_000,
    });
    expect([...players[0].listeners.keys()]).toEqual(
      expect.arrayContaining(["status", "metadata", "remoteCommand", "progress"]),
    );
    // Server clock samples reach the heard-track clock (no throw, any value).
    skew.listener?.(30_000, 100);
  });

  it("samples decoded audio through Airwave while the visualizer is on and audio plays", async () => {
    const { createPlayerService } = await load();
    const { WAVE_POINTS } = await import("@/core/player/visualizer/audio-sampler");
    const service = createPlayerService();
    const player = players[0];
    service.setVisualizerEnabled(true);
    player.listeners.get("status")?.({ state: "playing", playWhenReady: true, network: "online" });
    expect(player.setAudioSampling).toHaveBeenLastCalledWith({ enabled: true, points: WAVE_POINTS });
    expect(player.listeners.has("audioSample")).toBe(true);
    service.setVisualizerEnabled(false);
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
  });
});
