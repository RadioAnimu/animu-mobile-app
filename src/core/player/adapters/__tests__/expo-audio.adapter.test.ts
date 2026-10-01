import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("reports whether the paused stream connection was actually released", () => {
    const adapter = new ExpoAudioAdapter();
    expect(adapter.releaseStream()).toBe(false); // no player yet

    adapter.play("https://stream");
    expect(adapter.releaseStream()).toBe(true);
    // No pause(): it would cancel an OS resume pending on focus regain.
    expect(created[0].pause).not.toHaveBeenCalled();
    expect(created[0].replace).toHaveBeenCalledTimes(1);

    setOS("ios");
    expect(adapter.releaseStream()).toBe(false);
  });

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
