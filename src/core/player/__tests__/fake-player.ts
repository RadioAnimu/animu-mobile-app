import { vi } from "vitest";
import type {
  MediaMetadata,
  NowPlayingMetadata as AirwaveNowPlaying,
  PlaybackState,
  PlayerEventMap,
  PlayerStatus,
} from "react-native-anything-player";

/** The slice of an Airwave player the service drives, with event emitters. */
export class FakePlayer {
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
    route: { kind: "speaker", name: null },
    sleepAt: null,
    qualities: [],
    quality: null,
    selectedQuality: null,
    video: null,
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
  selectQuality = vi.fn(async (_id: string) => {});
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

  /** The rendition playing (a switch landed, or a load opened it). */
  setQuality(quality: string | null): void {
    this.status = { ...this.status, quality };
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
