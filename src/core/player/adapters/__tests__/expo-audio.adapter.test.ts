import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";

import { ExpoAudioAdapter } from "@/core/player/adapters/expo-audio.adapter";
import type { AudioPlaybackStatus } from "@/core/player/ports";

type Listener = (payload: unknown) => void;

const makeNativePlayer = () => {
  const listeners = new Map<string, Listener>();
  return {
    listeners,
    isAudioSamplingSupported: false,
    loop: false,
    volume: 1,
    addListener: vi.fn((event: string, fn: Listener) => {
      listeners.set(event, fn);
      return { remove: () => listeners.delete(event) };
    }),
    play: vi.fn(),
    pause: vi.fn(),
    replace: vi.fn(),
    remove: vi.fn(),
    release: vi.fn(),
    setAudioSamplingEnabled: vi.fn(),
  };
};

let created: ReturnType<typeof makeNativePlayer>[] = [];

vi.mock("expo-audio", () => ({
  createAudioPlayer: vi.fn(() => {
    const player = makeNativePlayer();
    created.push(player);
    return player;
  }),
  setAudioModeAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const setOS = (os: "ios" | "android") => {
  (Platform as { OS: string }).OS = os;
};

describe("ExpoAudioAdapter", () => {
  beforeEach(() => {
    created = [];
    setOS("android");
  });

  it("forwards the patched interruption flag and buffer depth", () => {
    const adapter = new ExpoAudioAdapter();
    const seen: AudioPlaybackStatus[] = [];
    adapter.setStatusHandler((status) => seen.push(status));
    adapter.play("https://stream");

    created[0].listeners.get("playbackStatusUpdate")?.({
      playing: false,
      isBuffering: true,
      timeControlStatus: "paused",
      playbackState: "buffering",
      bufferedAhead: 4.2,
      interruption: "focus-loss-transient",
    });
    created[0].listeners.get("playbackStatusUpdate")?.({
      playing: true,
      isBuffering: false,
      timeControlStatus: "playing",
      playbackState: "ready",
    });

    expect(seen[0].interruption).toBe("focus-loss-transient");
    expect(seen[0].bufferedAheadSeconds).toBe(4.2);
    // An unpatched / cleared frame reads as "no system pause".
    expect(seen[1].interruption).toBeNull();
  });

  describe("frames sampled before a source swap returned (iOS sampledAt)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const frame = (extra: Record<string, unknown>) => ({
      playing: false,
      isBuffering: false,
      timeControlStatus: "paused",
      playbackState: "ready",
      ...extra,
    });

    it("drops a system-pause flag sampled while play() re-opened the source", () => {
      // Simulator repro: after a route loss, Play was cancelled 26ms later by
      // a `route-lost` frame the replace() emitted before play() cleared it.
      const adapter = new ExpoAudioAdapter();
      const seen: AudioPlaybackStatus[] = [];
      adapter.setStatusHandler((status) => seen.push(status));
      adapter.play("https://stream");
      vi.advanceTimersByTime(5_000);
      const emit = (status: Record<string, unknown>) =>
        created[0].listeners.get("playbackStatusUpdate")?.(status);
      let sampledInsideOpen = 0;
      created[0].replace.mockImplementation(() => {
        sampledInsideOpen = Date.now() + 0.4;
      });

      adapter.play("https://stream");
      emit(frame({ interruption: "route-lost", sampledAt: sampledInsideOpen }));
      expect(seen).toHaveLength(0);

      // Sampled after the open: a real system pause, delivered.
      vi.advanceTimersByTime(10);
      emit(frame({ interruption: "route-lost", sampledAt: Date.now() }));
      expect(seen.map((s) => s.interruption)).toEqual(["route-lost"]);
    });

    it("drops the stale playing/paused pair a live-edge load() leaves queued", () => {
      // Simulator repro: a stale `playing` then the replace's own pause read
      // as a fresh interruption, so every re-open armed the next (~10 cycles).
      const adapter = new ExpoAudioAdapter();
      const seen: AudioPlaybackStatus[] = [];
      adapter.setStatusHandler((status) => seen.push(status));
      adapter.play("https://stream");
      vi.advanceTimersByTime(5_000);
      const emit = (status: Record<string, unknown>) =>
        created[0].listeners.get("playbackStatusUpdate")?.(status);
      const beforeOpen = Date.now() - 2;

      adapter.load("https://stream");
      emit(frame({ playing: true, timeControlStatus: "playing", sampledAt: beforeOpen }));
      emit(frame({ sampledAt: Date.now() + 0.2 })); // the replace's own pause
      expect(seen).toHaveLength(0);

      vi.advanceTimersByTime(3_000);
      emit(frame({ playing: true, timeControlStatus: "playing", sampledAt: Date.now() }));
      expect(seen.map((s) => s.playing)).toEqual([true]);
    });

    it("passes unstamped frames (Android) through untouched", () => {
      const adapter = new ExpoAudioAdapter();
      const seen: AudioPlaybackStatus[] = [];
      adapter.setStatusHandler((status) => seen.push(status));
      adapter.play("https://stream");
      created[0].listeners.get("playbackStatusUpdate")?.(frame({}));
      expect(seen).toHaveLength(1);
    });
  });

  it("silences and frees the native player on dispose (remove() alone keeps it rendering)", () => {
    const adapter = new ExpoAudioAdapter();
    adapter.play("https://stream");
    const player = created[0];

    adapter.dispose();

    expect(player.pause).toHaveBeenCalled();
    expect(player.remove).toHaveBeenCalled();
    expect(player.release).toHaveBeenCalled();
    expect(adapter.hasPlayer).toBe(false);
  });

  it("frees the iOS keepalive loop when it stops", () => {
    setOS("ios");
    const adapter = new ExpoAudioAdapter();
    adapter.startKeepalive();
    const keepalive = created[0];

    adapter.stopKeepalive();

    expect(keepalive.pause).toHaveBeenCalled();
    expect(keepalive.release).toHaveBeenCalled();
  });

  it.each(["android", "ios"] as const)(
    "releases the paused stream connection on %s",
    (os) => {
      setOS(os);
      const adapter = new ExpoAudioAdapter();
      expect(adapter.releaseStream()).toBe(false); // no player yet

      adapter.play("https://stream");
      // AVPlayer keeps downloading a paused live stream too (~110s measured).
      expect(adapter.releaseStream()).toBe(true);
      // No pause(): it would cancel an OS resume pending on focus regain /
      // interruption end.
      expect(created[0].pause).not.toHaveBeenCalled();
      expect(created[0].replace).toHaveBeenCalledTimes(1);
    },
  );

  it("creates the native player once and replaces the source afterwards", () => {
    const adapter = new ExpoAudioAdapter();
    adapter.play("https://a");
    adapter.load("https://b");

    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(created[0].replace).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "https://b" }),
    );
  });
});
